import { Context } from "@azure/functions";
import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
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
import { servicePreferencesAvroFormatter } from "../utils/formatter/servicePreferencesAvroFormatter";

export type RetrievedServicePreferenceWithMaybePdvId = t.TypeOf<
  typeof RetrievedServicePreferenceWithMaybePdvId
>;
const RetrievedServicePreferenceWithMaybePdvId = t.intersection([
  RetrievedServicePreference,
  t.partial({ userPDVId: NonEmptyString })
]);

const config = getConfigOrThrow();

const servicePreferencesConfig = withTopic(
  config.servicePreferencesKafkaTopicConfig.SERVICE_PREFERENCES_TOPIC_NAME,
  config.servicePreferencesKafkaTopicConfig
    .SERVICE_PREFERENCES_TOPIC_CONNECTION_STRING
)(config.targetKafka);

const servicePreferencesTopic = {
  ...config.targetKafka,
  messageFormatter: servicePreferencesAvroFormatter()
};

const retrievedServicePreferencesOnKafkaAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> = KA.create(
  KP.fromConfig(
    servicePreferencesConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
    servicePreferencesTopic
  )
);

const throwAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> = EA.create();

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPINSIGHTS_INSTRUMENTATIONKEY)
);

const pdvIdEnricherAdapter: OutboundEnricher<RetrievedServicePreferenceWithMaybePdvId> = PDVA.create<
  RetrievedServicePreferenceWithMaybePdvId
>(config.ENRICH_PDVID_THROTTLING);

const run = (_context: Context, document: unknown): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedServicePreference,
    telemetryAdapter,
    pdvIdEnricherAdapter,
    retrievedServicePreferencesOnKafkaAdapter,
    throwAdapter
  ).process([document])();

export default run;
