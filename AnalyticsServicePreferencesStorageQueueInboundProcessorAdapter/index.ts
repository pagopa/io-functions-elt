import { Context } from "@azure/functions";
import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
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
import { servicePreferencesAvroFormatter } from "../utils/formatter/servicePreferencesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { pdvTokenizerClient } from "../utils/pdvTokenizerClient";
import { createRedisClientSingleton } from "../utils/redis";
import { RetrievedServicePreferenceWithMaybePdvId } from "../utils/types/decoratedTypes";

const config = getConfigOrThrow();

const servicePreferencesConfig = withTopic(
  config.servicePreferencesKafkaTopicConfig.SERVICE_PREFERENCES_TOPIC_NAME,
  config.servicePreferencesKafkaTopicConfig
    .SERVICE_PREFERENCES_TOPIC_CONNECTION_STRING
)(config.targetKafkaAuth);

const servicePreferencesTopic = {
  ...servicePreferencesConfig,
  messageFormatter: servicePreferencesAvroFormatter()
};

const retrievedServicePreferencesOnKafkaAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> =
  KA.create(
    KP.fromConfig(
      servicePreferencesConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
      servicePreferencesTopic
    )
  );

const throwAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> =
  EA.create();

const pdvTokenizer = pdvTokenizerClient(
  config.PDV_TOKENIZER_BASE_URL,
  config.PDV_TOKENIZER_API_KEY,
  httpOrHttpsApiFetch,
  config.PDV_TOKENIZER_BASE_PATH
);

const redisClientTask = createRedisClientSingleton(config);

const telemetryClient = TA.initTelemetryClient(
  config.APPINSIGHTS_INSTRUMENTATIONKEY
);

const telemetryAdapter = TA.create(telemetryClient);

const pdvIdEnricherAdapter: OutboundEnricher<RetrievedServicePreferenceWithMaybePdvId> =
  PDVA.create<RetrievedServicePreferenceWithMaybePdvId>(
    config.ENRICH_PDVID_THROTTLING,
    pdvTokenizer,
    redisClientTask,
    config.PDV_IDS_TTL as Second,
    telemetryClient
  );

const run = (_context: Context, document: unknown): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedServicePreference,
    telemetryAdapter,
    pdvIdEnricherAdapter,
    retrievedServicePreferencesOnKafkaAdapter,
    throwAdapter
  ).process([document])();

export default run;
