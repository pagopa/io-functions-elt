/* eslint-disable @typescript-eslint/naming-convention */ // disabled in order to use the naming convention used to flatten nested object to root ('_' char used as nested object separator)
import * as winston from "winston";
import { Context } from "@azure/functions";
import { createBlobService } from "azure-storage";

import {
  MessageModel,
  MESSAGE_COLLECTION_NAME
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";

import { QueueClient } from "@azure/storage-queue";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow } from "../utils/config";
import { IBulkOperationResult } from "../utils/bulkOperationResult";
import { avroMessageFormatter } from "../utils/formatter/messagesAvroFormatter";
import { cosmosdbInstance } from "../utils/cosmosdb";

import { initTelemetryClient } from "../utils/appinsights";
import { handleMessageChange } from "./handler";

// eslint-disable-next-line functional/no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

const config = getConfigOrThrow();

const messagesConfig = {
  ...config.targetKafka,
  sasl: {
    ...config.targetKafka.sasl,
    password: config.MessagesKafkaTopicConfig.MESSAGES_TOPIC_CONNECTION_STRING
  },
  topic: config.MessagesKafkaTopicConfig.MESSAGES_TOPIC_NAME
};

const messagesTopic = {
  ...messagesConfig,
  messageFormatter: avroMessageFormatter()
};

const kakfaClient = KP.fromConfig(
  messagesConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
  messagesTopic
);

const messageModel = new MessageModel(
  cosmosdbInstance.container(MESSAGE_COLLECTION_NAME),
  "message-content" as NonEmptyString
);

const messageContentBlobService = createBlobService(
  config.MessageContentPrimaryStorageConnection
);

const queueClient = new QueueClient(
  config.INTERNAL_STORAGE_CONNECTION_STRING,
  config.MESSAGES_FAILURE_QUEUE_NAME
);

const telemetryClient = initTelemetryClient(
  config.APPINSIGHTS_INSTRUMENTATIONKEY
);

const run = async (
  context: Context,
  documents: ReadonlyArray<unknown>
): Promise<IBulkOperationResult> => {
  logger = context.log;
  return handleMessageChange(
    documents,
    telemetryClient,
    messageModel,
    messageContentBlobService,
    kakfaClient,
    queueClient
  );
};

export default run;
