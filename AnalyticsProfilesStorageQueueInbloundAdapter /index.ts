import { Context } from "@azure/functions";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow, withTopic } from "../utils/config";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as EA from "../outbound/adapter/empty-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import * as PDVEA from "../outbound/adapter/personaldatavault-outbound-enricher";
import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { profilesAvroFormatter } from "../utils/formatter/profilesAvroFormatter";
import { RetrievedProfileWithToken } from "../utils/types/retrievedProfileWithToken";
import { personalDataVaultClient } from "../clients/personalDataValult";

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

const throwAdapter: OutboundPublisher<RetrievedProfileWithToken> = EA.create();

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPINSIGHTS_INSTRUMENTATIONKEY)
);

const personalDataVaultEnricherAdapter: OutboundEnricher<RetrievedProfileWithToken> = PDVEA.create(
  personalDataVaultClient
);

const run = (_context: Context, document: unknown): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedProfileWithToken,
    telemetryAdapter,
    personalDataVaultEnricherAdapter,
    retrievedProfileOnKafkaAdapter,
    throwAdapter
  ).process([document])();

export default run;
