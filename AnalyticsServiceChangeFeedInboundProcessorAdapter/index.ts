import { Context } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow } from "../utils/config";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as QA from "../outbound/adapter/queue-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import * as EEA from "../outbound/adapter/empty-outbound-enricher";
import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { avroServiceFormatter } from "../utils/formatter/servicesAvroFormatter";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";

const config = getConfigOrThrow();

const servicesTopic = {
  ...config.targetKafka,
  messageFormatter: avroServiceFormatter(config.SERVICEID_EXCLUSION_LIST)
};
const retrievedServiceOnKafkaAdapter: OutboundPublisher<RetrievedService> = KA.create(
  KP.fromConfig(
    servicesTopic as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
    servicesTopic
  )
);

const retrievedServiceOnQueueAdapter: OutboundPublisher<RetrievedService> = QA.create(
  new QueueClient(
    config.INTERNAL_STORAGE_CONNECTION_STRING,
    config.SERVICES_FAILURE_QUEUE_NAME
  )
);

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPINSIGHTS_INSTRUMENTATIONKEY)
);

const emptyEnricherAdapter: OutboundEnricher<RetrievedService> = EEA.create();

const run = (
  _context: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedService,
    telemetryAdapter,
    emptyEnricherAdapter,
    retrievedServiceOnKafkaAdapter,
    retrievedServiceOnQueueAdapter
  ).process(documents)();

export default run;
