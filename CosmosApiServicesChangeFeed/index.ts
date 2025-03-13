/* eslint-disable @typescript-eslint/naming-convention */ // disabled in order to use the naming convention used to flatten nested object to root ('_' char used as nested object separator)
import { AzureNamedKeyCredential, TableClient } from "@azure/data-tables";
import { Context } from "@azure/functions";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import * as winston from "winston";

import { IBulkOperationResult } from "../utils/bulkOperationResult";
import { getConfigOrThrow } from "../utils/config";
import { avroServiceFormatter } from "../utils/formatter/servicesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { handleServicesChange } from "./handler";

let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
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

const errorStorage = new TableClient(
  `https://${config.ERROR_STORAGE_ACCOUNT}.table.core.windows.net`,
  config.ERROR_STORAGE_TABLE,
  new AzureNamedKeyCredential(
    config.ERROR_STORAGE_ACCOUNT,
    config.ERROR_STORAGE_KEY
  )
);

const run = async (
  context: Context,
  documents: ReadonlyArray<unknown>
): Promise<IBulkOperationResult> => {
  logger = context.log;
  return handleServicesChange(kakfaClient, errorStorage, documents);
};

export default run;
