import * as winston from "winston";
import { Context } from "@azure/functions";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import {
  MessageStatusModel,
  MESSAGE_STATUS_COLLECTION_NAME
} from "@pagopa/io-functions-commons/dist/src/models/message_status";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { getConfigOrThrow } from "../utils/config";
import handle from "./handler";

// eslint-disable-next-line functional/no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

const config = getConfigOrThrow();

const messageStatusContainer = cosmosdbInstance.container(
  MESSAGE_STATUS_COLLECTION_NAME
);

const messageStatusModel = new MessageStatusModel(messageStatusContainer);

const run = async (
  context: Context,
  rawMessageStatus: ReadonlyArray<unknown>
): Promise<ReadonlyArray<number>> => {
  logger = context.log;
  return handle(
    messageStatusContainer,
    messageStatusModel,
    config.TIME_THRESHOLD_FOR_MESSAGE_STATUS_FISCALCODE_UPDATE,
    rawMessageStatus
  );
};

export default run;
