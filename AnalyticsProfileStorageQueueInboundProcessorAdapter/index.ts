import { Context } from "@azure/functions";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { Second } from "@pagopa/ts-commons/lib/units";

import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import * as EA from "../outbound/adapter/empty-outbound-publisher";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as PDVA from "../outbound/adapter/pdv-id-outbound-enricher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { getConfigOrThrow, withTopic } from "../utils/config";
import { httpOrHttpsApiFetch } from "../utils/fetch";
import { profilesAvroFormatter } from "../utils/formatter/profilesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
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

const retrievedProfilesOnKafkaAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> =
  KA.create(
    KP.fromConfig(
      profilesConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
      profilesTopic
    )
  );

const throwAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> =
  EA.create();

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

const telemetryAdapter = TA.create(telemetryClient);

const pdvIdEnricherAdapter: OutboundEnricher<RetrievedProfileWithMaybePdvId> =
  PDVA.create<RetrievedProfileWithMaybePdvId>(
    config.ENRICH_PDVID_THROTTLING,
    pdvTokenizer,
    redisClientTask,
    config.PDV_IDS_TTL as Second,
    telemetryClient
  );

const run = (_context: Context, document: unknown): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedProfile,
    telemetryAdapter,
    pdvIdEnricherAdapter,
    retrievedProfilesOnKafkaAdapter,
    throwAdapter
  ).process([document])();

export default run;
