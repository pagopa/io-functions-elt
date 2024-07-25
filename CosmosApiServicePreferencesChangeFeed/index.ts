/* eslint-disable @typescript-eslint/naming-convention */ // disabled in order to use the naming convention used to flatten nested object to root ('_' char used as nested object separator)
import * as winston from "winston";
import { Context } from "@azure/functions";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow, withTopic } from "../utils/config";
import { IBulkOperationResult } from "../utils/bulkOperationResult";
import { servicePreferencesAvroFormatter } from "../utils/formatter/servicePreferencesAvroFormatter";
import { handleServicePreferencesChange } from "./handler";

// eslint-disable-next-line functional/no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

const config = getConfigOrThrow();

const servicePreferencesConfig = withTopic(
  config.servicePreferencesKafkaTopicConfig.SERVICE_PREFERENCES_TOPIC_NAME,
  config.servicePreferencesKafkaTopicConfig
    .SERVICE_PREFERENCES_TOPIC_CONNECTION_STRING
)(config.targetKafka);

const servicePreferencesTopic = {
  ...servicePreferencesConfig,
  messageFormatter: servicePreferencesAvroFormatter()
};

const kakfaClient = KP.fromConfig(
  servicePreferencesConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
  servicePreferencesTopic
);

const errorStorage = new TableClient(
  `https://${config.ERROR_STORAGE_ACCOUNT}.table.core.windows.net`,
  config.ERROR_STORAGE_TABLE_MESSAGE_STATUS,
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
  return handleServicePreferencesChange(kakfaClient, errorStorage, documents);
};

export default run;
