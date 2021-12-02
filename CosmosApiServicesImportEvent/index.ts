import { createBlobService } from "azure-storage";

// disabled in order to use the naming convention used to flatten nested object to root ('_' char used as nested object separator)
/* eslint-disable @typescript-eslint/naming-convention */ import * as winston from "winston";
import { Context } from "@azure/functions";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";

import {
  ServiceModel,
  SERVICE_COLLECTION_NAME
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  MessageModel,
  MESSAGE_COLLECTION_NAME
} from "@pagopa/io-functions-commons/dist/src/models/message";
import * as t from "io-ts";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { getConfigOrThrow } from "../utils/config";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { avroServiceFormatter } from "../utils/formatter/servicesAvroFormatter";
import {
  IBulkOperationResult,
  toBulkOperationResultEntity
} from "../utils/bulkOperationResult";
import { importServices } from "./handler.services";
import { processMessages } from "./handler.messages";

const CommandServices = t.interface({ operation: t.literal("import-service") });
const CommandMessages = t.interface({
  operation: t.literal("import-messages"),
  range_min: t.number,
  // eslint-disable-next-line sort-keys
  range_max: t.number
});

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
  cosmosdbInstance.container(MESSAGE_COLLECTION_NAME),
  "message-content" as NonEmptyString
);

const messageContentBlobService = createBlobService(
  config.MessageContentStorageConnection
);

const csvFilesBlobService = createBlobService(config.COMMAND_STORAGE);

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
  messageFormatter: avroServiceFormatter
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

  if (CommandServices.is(_command)) {
    return importServices(serviceModel, kakfaClient, errorStorage);
  } else if (CommandMessages.is(_command)) {
    return processMessages(
      messageModel,
      messageContentBlobService,
      csvFilesBlobService,
      config.COSMOS_DEGREE_OF_PARALLELISM,
      config.COSMOS_CHUNK_SIZE,
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
