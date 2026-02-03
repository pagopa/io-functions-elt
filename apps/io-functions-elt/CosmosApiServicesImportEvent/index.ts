import { TableClient } from "@azure/data-tables";
import { Context } from "@azure/functions";
import {
  SERVICE_COLLECTION_NAME,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import * as winston from "winston";

import {
  IBulkOperationResult,
  toBulkOperationResultEntity
} from "../utils/bulkOperationResult";
import { getConfigOrThrow } from "../utils/config";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { avroServiceFormatter } from "../utils/formatter/servicesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { CommandImportServices } from "./commands";
import { importServices } from "./handler.services";

let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
}) as unknown as winston.transport;
winston.add(contextTransport);

const config = getConfigOrThrow();

const serviceModel = new ServiceModel(
  cosmosdbInstance.container(SERVICE_COLLECTION_NAME)
);

const errorStorage = TableClient.fromConnectionString(
  config.BLOB_COMMAND_STORAGE,
  config.ERROR_STORAGE_TABLE
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
  } else {
    return toBulkOperationResultEntity("non-valid-command")({
      isSuccess: true,
      result: `nothing to do: " ${_command}`
    });
  }
};

export default run;
