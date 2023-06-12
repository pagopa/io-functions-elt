import { Context } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow, withTopic } from "../utils/config";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as QA from "../outbound/adapter/queue-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import * as PDVEA from "../outbound/adapter/personaldatavault-outbound-enricher";
import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { profilesAvroFormatter } from "../utils/formatter/profilesAvroFormatter";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { personalDataVaultClient } from "../clients/personalDataValult";
import { RetrievedProfileWithToken } from "../utils/types/retrievedProfileWithToken";

const config = getConfigOrThrow();

const profilesTopic = {
  ...withTopic(
    config.PROFILES_TOPIC_NAME,
    config.PROFILES_TOPIC_CONNECTION_STRING
  )(config.targetKafka),
  messageFormatter: profilesAvroFormatter()
};

const retrievedProfileOnKafkaAdapter: OutboundPublisher<RetrievedProfileWithToken> = KA.create(
  KP.fromConfig(
    profilesTopic as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
    profilesTopic
  )
);

const retrievedProfileOnQueueAdapter: OutboundPublisher<RetrievedProfileWithToken> = QA.create(
  new QueueClient(
    config.INTERNAL_STORAGE_CONNECTION_STRING,
    config.PROFILES_FAILURE_QUEUE_NAME
  )
);

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPINSIGHTS_INSTRUMENTATIONKEY)
);

const personalDataVaultEnricherAdapter: OutboundEnricher<RetrievedProfileWithToken> = PDVEA.create(
  personalDataVaultClient
);

const run = (
  _context: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedProfileWithToken,
    telemetryAdapter,
    personalDataVaultEnricherAdapter,
    retrievedProfileOnKafkaAdapter,
    retrievedProfileOnQueueAdapter
  ).process(documents)();

export default run;
