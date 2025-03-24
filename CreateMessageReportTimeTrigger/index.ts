import { AzureNamedKeyCredential, TableClient } from "@azure/data-tables";
import { AzureFunction } from "@azure/functions";

import { getConfigOrThrow } from "../utils/config";
import { timerTrigger } from "./handler";

const config = getConfigOrThrow();

const tableStorage = new TableClient(
  `https://${config.ERROR_STORAGE_ACCOUNT}.table.core.windows.net`,
  config.MESSAGE_EXPORTS_COMMAND_TABLE,
  new AzureNamedKeyCredential(
    config.ERROR_STORAGE_ACCOUNT,
    config.ERROR_STORAGE_KEY
  )
);

const run: AzureFunction = timerTrigger(tableStorage);

export default run;
