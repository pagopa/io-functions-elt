/* eslint-disable @typescript-eslint/naming-convention */ // disabled in order to use the naming convention used to flatten nested object to root ('_' char used as nested object separator)
import * as winston from "winston";
import { Context } from "@azure/functions";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { getConfigOrThrow } from "../utils/config";

import * as T from "fp-ts/Task";

// eslint-disable-next-line functional/no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

const config = getConfigOrThrow();

const errorStorage = new TableClient(
  `https://${config.ERROR_STORAGE_ACCOUNT}.table.core.windows.net`,
  config.ERROR_STORAGE_TABLE,
  new AzureNamedKeyCredential(
    config.ERROR_STORAGE_ACCOUNT,
    config.ERROR_STORAGE_KEY
  )
);

const changeFeedStart = async (context: Context, command: unknown) => {
  logger = context.log;
  return T.of({
    result: `${command}`,
    partitionKey: `${new Date().getMonth() + 1}`,
    rowKey: `${Date.now()}`
  })();
};

export default changeFeedStart;
