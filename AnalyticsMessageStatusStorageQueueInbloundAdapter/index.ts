import { Context } from "@azure/functions";
import { RetrievedMessageStatus } from "@pagopa/io-functions-commons/dist/src/models/message_status";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow, withTopic } from "../utils/config";
import { messageStatusAvroFormatter } from "../utils/formatter/messageStatusAvroFormatter";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as EA from "../outbound/adapter/throw-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";

const config = getConfigOrThrow();

const messageStatusConfig = withTopic(
  config.messageStatusKafkaTopicConfig.MESSAGE_STATUS_TOPIC_NAME,
  config.messageStatusKafkaTopicConfig.MESSAGE_STATUS_TOPIC_CONNECTION_STRING
)(config.targetKafka);
const messageStatusTopic = {
  ...messageStatusConfig,
  messageFormatter: messageStatusAvroFormatter()
};
const messageStatusOnKafkaAdapter: OutboundPublisher<RetrievedMessageStatus> = KA.create(
  KP.fromConfig(
    messageStatusConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
    messageStatusTopic
  )
);

const throwAdapter: OutboundPublisher<RetrievedMessageStatus> = EA.create();

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPINSIGHTS_INSTRUMENTATIONKEY)
);

const run = (_context: Context, document: unknown): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedMessageStatus,
    telemetryAdapter,
    messageStatusOnKafkaAdapter,
    throwAdapter
  ).process([document])();

export default run;
