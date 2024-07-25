/* eslint-disable sort-keys */
import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import * as avro from "avsc";
import { MessageFormatter } from "../kafka/KafkaTypes";
import { servicePreferences } from "../../generated/avro/dto/servicePreferences";

// remove me
export const buildAvroServicePreferencesObject = (
  retrievedServicePreferences: RetrievedServicePreference
): Omit<servicePreferences, "schema" | "subject"> => {
  const pdvId = retrievedServicePreferences.fiscalCode;

  return {
    id: retrievedServicePreferences.id,
    userPDVId: pdvId,
    settingsVersion: retrievedServicePreferences.settingsVersion,
    serviceId: retrievedServicePreferences.serviceId,
    isInboxEnabled: retrievedServicePreferences.isInboxEnabled,
    isEmailEnabled: retrievedServicePreferences.isEmailEnabled,
    isWebhookEnabled: retrievedServicePreferences.isWebhookEnabled,
    accessReadMessageStatus:
      retrievedServicePreferences.accessReadMessageStatus,
    // eslint-disable-next-line sort-keys, no-underscore-dangle
    timestamp: retrievedServicePreferences._ts * 1000
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const servicePreferencesAvroFormatter = (): MessageFormatter<RetrievedServicePreference> => servicePreference => ({
  // messageId as Partition Key
  key: servicePreference.id,
  value: avro.Type.forSchema(
    servicePreferences.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
  ).toBuffer(
    Object.assign(
      new servicePreferences(),
      buildAvroServicePreferencesObject(servicePreference)
    )
  )
});
