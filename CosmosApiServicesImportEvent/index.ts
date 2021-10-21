/* eslint-disable @typescript-eslint/naming-convention */ // disabled in order to use the naming convention used to flatten nested object to root ('_' char used as nested object separator)
import * as winston from "winston";
import { Context } from "@azure/functions";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { getConfigOrThrow } from "../utils/config";
import * as KP from "../utils/kafka/KafkaProducerCompact";

import * as T from "fp-ts/Task";
import {
  ServiceModel,
  SERVICE_COLLECTION_NAME
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { importServices } from "./handler";
import { avroServiceFormatter } from "../CosmosApiServicesChangeFeed";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";

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

const changeFeedStart = async (context: Context, command: unknown) =>
  importServices(serviceModel, kakfaClient, errorStorage);

export default changeFeedStart;
