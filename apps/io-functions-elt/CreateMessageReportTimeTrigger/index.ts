import { TableClient } from "@azure/data-tables";
import { AzureFunction } from "@azure/functions";

import { getConfigOrThrow } from "../utils/config";
import { timerTrigger } from "./handler";

const config = getConfigOrThrow();

const errorStorage = TableClient.fromConnectionString(
  config.BLOB_COMMAND_STORAGE,
  config.ERROR_STORAGE_TABLE_MESSAGES
);

const run: AzureFunction = timerTrigger(errorStorage);

export default run;
