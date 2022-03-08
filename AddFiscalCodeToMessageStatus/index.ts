import * as winston from "winston";
import { Context } from "@azure/functions";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { MESSAGE_STATUS_COLLECTION_NAME } from "@pagopa/io-functions-commons/dist/src/models/message_status";
import { cosmosdbInstance } from "../utils/cosmosdb";
import handle from "./handler";

// eslint-disable-next-line functional/no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

const messageStatusContainer = cosmosdbInstance.container(
  MESSAGE_STATUS_COLLECTION_NAME
);

// const config = getConfigOrThrow();
// const errorStorage = new TableClient(
//   `https://${config.ERROR_STORAGE_ACCOUNT}.table.core.windows.net`,
//   config.ERROR_STORAGE_TABLE,
//   new AzureNamedKeyCredential(
//     config.ERROR_STORAGE_ACCOUNT,
//     config.ERROR_STORAGE_KEY
//   )
// );

const run = async (
  context: Context,
  rawMessageStatus: ReadonlyArray<unknown>
): Promise<ReadonlyArray<number>> => {
  logger = context.log;
  return handle(messageStatusContainer, rawMessageStatus);
};

export default run;
