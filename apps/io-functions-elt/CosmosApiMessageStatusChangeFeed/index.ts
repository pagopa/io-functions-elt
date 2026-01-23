import { Context } from "@azure/functions";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import * as winston from "winston";

import { createTableClientWithManagedIdentity } from "../utils/azure-identity";
import { IBulkOperationResult } from "../utils/bulkOperationResult";
import { getConfigOrThrow, withTopic } from "../utils/config";
import { messageStatusAvroFormatter } from "../utils/formatter/messageStatusAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { handleMessageStatusChange } from "./handler";

let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
}) as unknown as winston.transport;
winston.add(contextTransport);

const config = getConfigOrThrow();

const messageStatusConfig = withTopic(
  config.messageStatusKafkaTopicConfig.MESSAGE_STATUS_TOPIC_NAME,
  config.messageStatusKafkaTopicConfig.MESSAGE_STATUS_TOPIC_CONNECTION_STRING
)(config.targetKafka);

const messageStatusTopic = {
  ...messageStatusConfig,
  messageFormatter: messageStatusAvroFormatter()
};

const kakfaClient = KP.fromConfig(
  messageStatusConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
  messageStatusTopic
);

const errorStorage = createTableClientWithManagedIdentity(
  config.ERROR_STORAGE_ACCOUNT,
  config.ERROR_STORAGE_TABLE_MESSAGE_STATUS
);

const run = async (
  context: Context,
  documents: readonly unknown[]
): Promise<IBulkOperationResult> => {
  logger = context.log;
  return handleMessageStatusChange(kakfaClient, errorStorage, documents);
};

export default run;
