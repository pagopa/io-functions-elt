import { Context } from "@azure/functions";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow, withTopic } from "../utils/config";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as EA from "../outbound/adapter/empty-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import * as PDVA from "../outbound/adapter/pdv-id-outbound-enricher";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { profilesAvroFormatter } from "../utils/formatter/profilesAvroFormatter";

export type RetrievedProfileWithMaybePdvId = t.TypeOf<
  typeof RetrievedProfileWithMaybePdvId
>;
const RetrievedProfileWithMaybePdvId = t.intersection([
  RetrievedProfile,
  t.partial({ userPDVId: NonEmptyString })
]);

const config = getConfigOrThrow();

const profilesConfig = withTopic(
  config.profilesKafkaTopicConfig.PROFILES_TOPIC_NAME,
  config.profilesKafkaTopicConfig.PROFILES_TOPIC_CONNECTION_STRING
)(config.targetKafka);

const profilesTopic = {
  ...profilesConfig,
  messageFormatter: profilesAvroFormatter()
};

const retrievedProfilesOnKafkaAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> = KA.create(
  KP.fromConfig(
    profilesConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
    profilesTopic
  )
);

const throwAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> = EA.create();

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPINSIGHTS_INSTRUMENTATIONKEY)
);

const pdvIdEnricherAdapter: OutboundEnricher<RetrievedProfileWithMaybePdvId> = PDVA.create<
  RetrievedProfileWithMaybePdvId
>(config.ENRICH_PDVID_THROTTLING);

const run = (_context: Context, document: unknown): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedProfile,
    telemetryAdapter,
    pdvIdEnricherAdapter,
    retrievedProfilesOnKafkaAdapter,
    throwAdapter
  ).process([document])();

export default run;
