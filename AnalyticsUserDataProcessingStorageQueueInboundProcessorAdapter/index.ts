import { Context } from "@azure/functions";
import { RetrievedUserDataProcessing } from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
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
import { profileDeletionAvroFormatter } from "../utils/formatter/deletesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { pdvTokenizerClient } from "../utils/pdvTokenizerClient";
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

const profileDeletionsOnKafkaAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> =
  KA.create(
    KP.fromConfig(
      profileDeletionConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
      profileDeletionTopic
    )
  );

const throwAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> =
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

const pdvIdEnricherAdapter: OutboundEnricher<RetrievedUserDataProcessingWithMaybePdvId> =
  PDVA.create<RetrievedUserDataProcessingWithMaybePdvId>(
    config.ENRICH_PDVID_THROTTLING,
    pdvTokenizer,
    redisClientTask,
    config.PDV_IDS_TTL as Second,
    telemetryClient
  );

const run = (_context: Context, document: unknown): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedUserDataProcessing,
    telemetryAdapter,
    pdvIdEnricherAdapter,
    profileDeletionsOnKafkaAdapter,
    throwAdapter
  ).process([document])();

export default run;
