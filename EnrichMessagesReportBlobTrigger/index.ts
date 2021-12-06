import { createBlobService } from "azure-storage";
import { AzureFunction } from "@azure/functions";

import { getConfigOrThrow } from "../utils/config";
import { exportTextToBlob } from "../utils/azure-storage";

import { handler } from "./handler";

const config = getConfigOrThrow();

const csvFilesBlobService = createBlobService(config.COMMAND_STORAGE);

const blobTrigger: AzureFunction = handler(
  exportTextToBlob(
    csvFilesBlobService,
    config.MESSAGE_EXPORT_STEP_FINAL_CONTAINER
  )
);

export default blobTrigger;
