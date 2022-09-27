import { Context } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";
import { RetrievedMessageStatus } from "@pagopa/io-functions-commons/dist/src/models/message_status";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow, withTopic } from "../utils/config";
import { messageStatusAvroFormatter } from "../utils/formatter/messageStatusAvroFormatter";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as QA from "../outbound/adapter/queue-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import { processMessageStatus } from "../businesslogic/analytics-message-status";
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

const messageStatusOnQueueAdapter: OutboundPublisher<RetrievedMessageStatus> = QA.create(
  new QueueClient(
    config.INTERNAL_STORAGE_CONNECTION_STRING,
    config.MESSAGE_STATUS_FAILURE_QUEUE_NAME
  )
);

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPINSIGHTS_INSTRUMENTATIONKEY)
);

const run = (
  _context: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> =>
  processMessageStatus(
    telemetryAdapter,
    messageStatusOnKafkaAdapter,
    messageStatusOnQueueAdapter,
    documents
  )();

export default run;
