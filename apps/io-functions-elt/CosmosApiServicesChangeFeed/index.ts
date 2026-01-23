import { Context } from "@azure/functions";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import * as winston from "winston";

import { createTableClientWithManagedIdentity } from "../utils/azure-identity";
import { IBulkOperationResult } from "../utils/bulkOperationResult";
import { getConfigOrThrow } from "../utils/config";
import { avroServiceFormatter } from "../utils/formatter/servicesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { handleServicesChange } from "./handler";

let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
}) as unknown as winston.transport;
winston.add(contextTransport);

const config = getConfigOrThrow();

const servicesTopic = {
  ...config.targetKafka,
  messageFormatter: avroServiceFormatter(config.SERVICEID_EXCLUSION_LIST)
};

const kakfaClient = KP.fromConfig(
  config.targetKafka as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
  servicesTopic
);

const errorStorage = createTableClientWithManagedIdentity(
  config.ERROR_STORAGE_ACCOUNT,
  config.ERROR_STORAGE_TABLE
);

const run = async (
  context: Context,
  documents: readonly unknown[]
): Promise<IBulkOperationResult> => {
  logger = context.log;
  return handleServicesChange(kakfaClient, errorStorage, documents);
};

export default run;
