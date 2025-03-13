/* eslint-disable @typescript-eslint/naming-convention */ // disabled in order to use the naming convention used to flatten nested object to root ('_' char used as nested object separator)
import { AzureNamedKeyCredential, TableClient } from "@azure/data-tables";
import { Context } from "@azure/functions";
import {
  MESSAGE_COLLECTION_NAME,
  MessageModel
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { createBlobService } from "azure-storage";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as winston from "winston";

import { MessageContentType } from "../generated/avro/dto/MessageContentTypeEnum";
import { IBulkOperationResult } from "../utils/bulkOperationResult";
import { getConfigOrThrow } from "../utils/config";
import { cosmosdbInstance } from "../utils/cosmosdb";
import {
  ThirdPartyDataWithCategoryFetcher,
  avroMessageFormatter
} from "../utils/formatter/messagesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { handleMessageChange } from "./handler";

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

const thirdPartyDataWithCategoryFetcher: ThirdPartyDataWithCategoryFetcher = (
  serviceId
) =>
  pipe(
    serviceId,
    E.fromPredicate(
      (id) => id === config.PN_SERVICE_ID,
      (id) => Error(`Missing third-party service configuration for ${id}`)
    ),
    E.map(() => MessageContentType.PN),
    E.mapLeft((e) => logger?.error({ exception: e })),
    E.mapLeft(() => MessageContentType.GENERIC),
    E.toUnion
  );

const messageStatusTopic = {
  ...messagesConfig,
  messageFormatter: avroMessageFormatter(thirdPartyDataWithCategoryFetcher)
};

const kakfaClient = KP.fromConfig(
  messagesConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
  messageStatusTopic
);

const errorStorage = new TableClient(
  `https://${config.ERROR_STORAGE_ACCOUNT}.table.core.windows.net`,
  config.ERROR_STORAGE_TABLE_MESSAGES,
  new AzureNamedKeyCredential(
    config.ERROR_STORAGE_ACCOUNT,
    config.ERROR_STORAGE_KEY
  )
);

const messageModel = new MessageModel(
  cosmosdbInstance.container(MESSAGE_COLLECTION_NAME),
  "message-content" as NonEmptyString
);

const messageContentBlobService = createBlobService(
  config.MessageContentPrimaryStorageConnection
);

const run = async (
  context: Context,
  documents: ReadonlyArray<unknown>
): Promise<IBulkOperationResult> => {
  logger = context.log;
  return handleMessageChange(messageModel, messageContentBlobService)(
    kakfaClient,
    errorStorage,
    documents
  );
};

export default run;
