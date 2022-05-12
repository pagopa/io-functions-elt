import * as winston from "winston";
import { Context } from "@azure/functions";
import { createBlobService } from "azure-storage";
import {
  MessageModel,
  MESSAGE_COLLECTION_NAME
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow } from "../utils/config";
import { IBulkOperationResult } from "../utils/bulkOperationResult";
import { avroMessageFormatter } from "../utils/formatter/messagesAvroFormatter";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { initTelemetryClient } from "../utils/appinsights";
import { handle } from "./handler";

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

const telemetryClient = initTelemetryClient(
  config.APPINSIGHTS_INSTRUMENTATIONKEY
);

const run = async (
  context: Context,
  documents: ReadonlyArray<unknown>
): Promise<IBulkOperationResult> => {
  logger = context.log;
  return handle(
    documents,
    telemetryClient,
    messageModel,
    messageContentBlobService,
    kakfaClient
  );
};

export default run;
