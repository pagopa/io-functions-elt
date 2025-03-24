import { AzureNamedKeyCredential, TableClient } from "@azure/data-tables";
import { Context } from "@azure/functions";
import {
  MESSAGE_COLLECTION_NAME,
  MessageModel
} from "@pagopa/io-functions-commons/dist/src/models/message";
import {
  SERVICE_COLLECTION_NAME,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { createBlobService } from "azure-storage";
import * as winston from "winston";

import { exportTextToBlob } from "../utils/azure-storage";
import {
  IBulkOperationResult,
  toBulkOperationResultEntity
} from "../utils/bulkOperationResult";
import { getConfigOrThrow } from "../utils/config";
import { cosmosdbInstance, cosmosdbInstanceReplica } from "../utils/cosmosdb";
import { avroServiceFormatter } from "../utils/formatter/servicesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { CommandImportServices, CommandMessageReport } from "./commands";
import { processMessages } from "./handler.messages";
import { importServices } from "./handler.services";

// eslint-disable-next-line functional/no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

const config = getConfigOrThrow();

const serviceModel = new ServiceModel(
  cosmosdbInstance.container(SERVICE_COLLECTION_NAME)
);

const messageModel = new MessageModel(
  cosmosdbInstanceReplica.container(MESSAGE_COLLECTION_NAME),
  "message-content" as NonEmptyString
);

const messageContentBlobService = createBlobService(
  config.MessageContentStorageConnection
);

const csvFilesBlobService = createBlobService(config.BLOB_COMMAND_STORAGE);

const errorStorage = new TableClient(
  `https://${config.ERROR_STORAGE_ACCOUNT}.table.core.windows.net`,
  config.ERROR_STORAGE_TABLE,
  new AzureNamedKeyCredential(
    config.ERROR_STORAGE_ACCOUNT,
    config.ERROR_STORAGE_KEY
  )
);

const servicesTopic = {
  ...config.targetKafka,
  messageFormatter: avroServiceFormatter(config.SERVICEID_EXCLUSION_LIST)
};

const kakfaClient = KP.fromConfig(
  config.targetKafka as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
  servicesTopic
);

const run = async (
  _context: Context,
  _command: unknown
): Promise<IBulkOperationResult> => {
  _context.log("COMANDO", _command);

  if (CommandImportServices.is(_command)) {
    return importServices(serviceModel, kakfaClient, errorStorage);
  } else if (CommandMessageReport.is(_command)) {
    return processMessages(
      messageModel,
      messageContentBlobService,
      exportTextToBlob(
        csvFilesBlobService,
        config.MESSAGE_EXPORT_STEP_1_CONTAINER
      ),
      config.COSMOS_CHUNK_SIZE,
      config.COSMOS_DEGREE_OF_PARALLELISM,
      config.MESSAGE_CONTENT_CHUNK_SIZE
    )(_context, _command.range_min, _command.range_max);
  } else {
    return toBulkOperationResultEntity("non-valid-command")({
      isSuccess: true,
      result: `nothing to do: " ${_command}`
    });
  }
};

export default run;
