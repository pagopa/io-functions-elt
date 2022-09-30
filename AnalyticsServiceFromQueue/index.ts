import { Context } from "@azure/functions";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow } from "../utils/config";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as EA from "../outbound/adapter/throw-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { processService } from "../businesslogic/analytics-services";
import { avroServiceFormatter } from "../utils/formatter/servicesAvroFormatter";

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

const throwAdapter: OutboundPublisher<RetrievedService> = EA.create();

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPINSIGHTS_INSTRUMENTATIONKEY)
);

const run = (_context: Context, document: unknown): Promise<void> =>
  processService(
    telemetryAdapter,
    retrievedServiceOnKafkaAdapter,
    throwAdapter,
    [document]
  )();

export default run;
