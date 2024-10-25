import { QueueClient } from "@azure/storage-queue";
import { Context } from "@azure/functions";

import { RetrievedUserDataProcessing } from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { UserDataProcessingStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import { Second } from "@pagopa/ts-commons/lib/units";
import { UserDataProcessingChoiceEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
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
import { httpOrHttpsApiFetch } from "../utils/fetch";
import { pdvTokenizerClient } from "../utils/pdvTokenizerClient";
import { profileDeletionAvroFormatter } from "../utils/formatter/deletesAvroFormatter";
import { createRedisClientSingleton } from "../utils/redis";
import { RetrievedUserDataProcessingWithMaybePdvId } from "../utils/types/decoratedTypes";

const config = getConfigOrThrow();

const profileDeletionConfig = withTopic(
  config.deletesKafkaTopicConfig.DELETES_TOPIC_NAME,
  config.deletesKafkaTopicConfig.DELETES_TOPIC_CONNECTION_STRING
)(config.targetKafkaAuth);

const profileDeletionTopic = {
  ...profileDeletionConfig,
  messageFormatter: profileDeletionAvroFormatter()
};

const profileDeletionsOnKafkaAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> = KA.create(
  KP.fromConfig(
    profileDeletionConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
    profileDeletionTopic
  )
);

const profileDeletionsOnQueueAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> = QA.create(
  profileDeletion => {
    // void storing userPDVId it in queue
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userPDVId, ...rest } = profileDeletion;
    return rest;
  },
  new QueueClient(
    config.INTERNAL_STORAGE_CONNECTION_STRING,
    config.DELETES_FAILURE_QUEUE_NAME
  )
);

const pdvTokenizer = pdvTokenizerClient(
  config.PDV_TOKENIZER_BASE_URL,
  config.PDV_TOKENIZER_API_KEY,
  httpOrHttpsApiFetch,
  config.PDV_TOKENIZER_BASE_PATH
);

const telemetryClient = TA.initTelemetryClient(
  config.APPINSIGHTS_INSTRUMENTATIONKEY
);

const redisClientTask = createRedisClientSingleton(config);

const pdvIdEnricherAdapter: OutboundEnricher<RetrievedUserDataProcessingWithMaybePdvId> = PDVA.create<
  RetrievedUserDataProcessingWithMaybePdvId
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
const userDataProcessingFilterer: OutboundFilterer<RetrievedUserDataProcessing> = PF.create(
  retrievedUserDataProcessing =>
    !internalTestFiscalCodeSet.has(retrievedUserDataProcessing.fiscalCode) &&
    retrievedUserDataProcessing.choice ===
      UserDataProcessingChoiceEnum.DELETE &&
    retrievedUserDataProcessing.status === UserDataProcessingStatusEnum.WIP
);

const run = (
  _context: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedUserDataProcessing,
    telemetryAdapter,
    pdvIdEnricherAdapter,
    profileDeletionsOnKafkaAdapter,
    profileDeletionsOnQueueAdapter,
    userDataProcessingFilterer
  ).process(documents)();

export default run;
