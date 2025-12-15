import { Context } from "@azure/functions";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";

import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import * as EEA from "../outbound/adapter/empty-outbound-enricher";
import * as EA from "../outbound/adapter/empty-outbound-publisher";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { getConfigOrThrow } from "../utils/config";
import { avroServiceFormatter } from "../utils/formatter/servicesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";

const config = getConfigOrThrow();

const servicesTopic = {
  ...config.targetKafka,
  messageFormatter: avroServiceFormatter(config.SERVICEID_EXCLUSION_LIST)
};
const retrievedServiceOnKafkaAdapter: OutboundPublisher<RetrievedService> =
  KA.create(
    KP.fromConfig(
      servicesTopic as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
      servicesTopic
    )
  );

const throwAdapter: OutboundPublisher<RetrievedService> = EA.create();

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPLICATIONINSIGHTS_CONNECTION_STRING)
);

const emptyEnricherAdapter: OutboundEnricher<RetrievedService> = EEA.create();

const run = (_context: Context, document: unknown): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedService,
    telemetryAdapter,
    emptyEnricherAdapter,
    retrievedServiceOnKafkaAdapter,
    throwAdapter
  ).process([document])();

export default run;
