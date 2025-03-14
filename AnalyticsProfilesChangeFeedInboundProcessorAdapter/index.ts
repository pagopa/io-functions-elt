import { QueueClient } from "@azure/storage-queue";
import { Context } from "@azure/functions";

import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { Second } from "@pagopa/ts-commons/lib/units";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import * as QA from "../outbound/adapter/queue-outbound-mapper-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import * as PF from "../outbound/adapter/predicate-outbound-filterer";
import * as PDVA from "../outbound/adapter/pdv-id-outbound-enricher";

import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";

import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow, withTopic } from "../utils/config";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { OutboundFilterer } from "../outbound/port/outbound-filterer";
import { profilesAvroFormatter } from "../utils/formatter/profilesAvroFormatter";
import { httpOrHttpsApiFetch } from "../utils/fetch";
import { pdvTokenizerClient } from "../utils/pdvTokenizerClient";
import { createRedisClientSingleton } from "../utils/redis";
import { RetrievedProfileWithMaybePdvId } from "../utils/types/decoratedTypes";

const config = getConfigOrThrow();

const profilesConfig = withTopic(
  config.profilesKafkaTopicConfig.PROFILES_TOPIC_NAME,
  config.profilesKafkaTopicConfig.PROFILES_TOPIC_CONNECTION_STRING
)(config.targetKafkaAuth);

const profilesTopic = {
  ...profilesConfig,
  messageFormatter: profilesAvroFormatter()
};

const profilesOnKafkaAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> = KA.create(
  KP.fromConfig(
    profilesConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
    profilesTopic
  )
);

const profilesOnQueueAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> = QA.create(
  profile => {
    // void storing userPDVId it in queue
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userPDVId, ...rest } = profile;
    return rest;
  },
  new QueueClient(
    config.INTERNAL_STORAGE_CONNECTION_STRING,
    config.PROFILES_FAILURE_QUEUE_NAME
  )
);

const pdvTokenizer = pdvTokenizerClient(
  config.PDV_TOKENIZER_BASE_URL,
  config.PDV_TOKENIZER_API_KEY,
  httpOrHttpsApiFetch,
  config.PDV_TOKENIZER_BASE_PATH
);

const redisClientTask = createRedisClientSingleton(config);

const telemetryClient = TA.initTelemetryClient(
  config.APPLICATIONINSIGHTS_CONNECTION_STRING
);

const pdvIdEnricherAdapter: OutboundEnricher<RetrievedProfileWithMaybePdvId> = PDVA.create<
  RetrievedProfileWithMaybePdvId
>(
  config.ENRICH_PDVID_THROTTLING,
  pdvTokenizer,
  redisClientTask,
  config.PDV_IDS_TTL as Second,
  telemetryClient
);

const telemetryAdapter = TA.create(telemetryClient);

const internalTestFiscalCodeSet = new Set(
  config.INTERNAL_TEST_FISCAL_CODES as ReadonlyArray<FiscalCode>
);
const profilesFilterer: OutboundFilterer<RetrievedProfile> = PF.create(
  retrievedProfile =>
    !internalTestFiscalCodeSet.has(retrievedProfile.fiscalCode)
);

const run = (
  _context: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedProfile,
    telemetryAdapter,
    pdvIdEnricherAdapter,
    profilesOnKafkaAdapter,
    profilesOnQueueAdapter,
    profilesFilterer
  ).process(documents)();

export default run;
