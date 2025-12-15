import { AzureFunction } from "@azure/functions";
import { createBlobService } from "azure-storage";

import { exportTextToBlob } from "../utils/azure-storage";
import { getConfigOrThrow } from "../utils/config";
import { handler } from "./handler";

const config = getConfigOrThrow();

const csvFilesBlobService = createBlobService(config.BLOB_COMMAND_STORAGE);

const blobTrigger: AzureFunction = handler(
  exportTextToBlob(
    csvFilesBlobService,
    config.MESSAGE_EXPORT_STEP_FINAL_CONTAINER
  )
);

export default blobTrigger;
