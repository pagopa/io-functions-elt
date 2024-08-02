import { QueueClient } from "@azure/storage-queue";
import { Context } from "@azure/functions";

import * as t from "io-ts";

import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import * as QA from "../outbound/adapter/queue-outbound-mapper-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import * as PF from "../outbound/adapter/predicate-outbound-filterer";
import * as PDVA from "../outbound/adapter/pdv-id-outbound-enricher";

import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";

import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow, withTopic } from "../utils/config";
import { servicePreferencesAvroFormatter } from "../utils/formatter/servicePreferencesAvroFormatter";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { OutboundFilterer } from "../outbound/port/outbound-filterer";

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
  ...servicePreferencesConfig,
  messageFormatter: servicePreferencesAvroFormatter()
};

const servicePreferencesOnKafkaAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> = KA.create(
  KP.fromConfig(
    servicePreferencesConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
    servicePreferencesTopic
  )
);

const servicePreferencesOnQueueAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> = QA.create(
  servicePreference => {
    // void storing userPDVId it in queue
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userPDVId, ...rest } = servicePreference;
    return rest;
  },
  new QueueClient(
    config.INTERNAL_STORAGE_CONNECTION_STRING,
    config.SERVICE_PREFERENCES_FAILURE_QUEUE_NAME
  )
);

const pdvIdEnricherAdapter: OutboundEnricher<RetrievedServicePreferenceWithMaybePdvId> = PDVA.create<
  RetrievedServicePreferenceWithMaybePdvId
>(config.ENRICH_PDVID_THROTTLING);

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPINSIGHTS_INSTRUMENTATIONKEY)
);

const internalTestFiscalCodeSet = new Set(
  config.INTERNAL_TEST_FISCAL_CODES as ReadonlyArray<FiscalCode>
);
const servicePreferencesFilterer: OutboundFilterer<RetrievedServicePreference> = PF.create(
  retrievedServicePreference =>
    !internalTestFiscalCodeSet.has(retrievedServicePreference.fiscalCode)
);

const run = (
  _context: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedServicePreference,
    telemetryAdapter,
    pdvIdEnricherAdapter,
    servicePreferencesOnKafkaAdapter,
    servicePreferencesOnQueueAdapter,
    servicePreferencesFilterer
  ).process(documents)();

export default run;
