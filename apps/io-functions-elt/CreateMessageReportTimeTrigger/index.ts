import { AzureFunction } from "@azure/functions";

import { createTableClientWithManagedIdentity } from "../utils/azure-identity";
import { getConfigOrThrow } from "../utils/config";
import { timerTrigger } from "./handler";

const config = getConfigOrThrow();

const tableStorage = createTableClientWithManagedIdentity(
  config.ERROR_STORAGE_ACCOUNT,
  config.MESSAGE_EXPORTS_COMMAND_TABLE
);

const run: AzureFunction = timerTrigger(tableStorage);

export default run;
