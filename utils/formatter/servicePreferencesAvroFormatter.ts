/* eslint-disable sort-keys */
import * as avro from "avsc";
import { MessageFormatter } from "../kafka/KafkaTypes";
import { servicePreferences } from "../../generated/avro/dto/servicePreferences";
import { RetrievedServicePreferenceWithMaybePdvId } from "../../AnalyticsServicePreferencesChangeFeedInboundProcessorAdapter";

// remove me
export const buildAvroServicePreferencesObject = (
  retrievedServicePreferencesWithPdvId: RetrievedServicePreferenceWithMaybePdvId
): Omit<servicePreferences, "schema" | "subject"> => ({
  id: retrievedServicePreferencesWithPdvId.id.replace(
    retrievedServicePreferencesWithPdvId.fiscalCode,
    retrievedServicePreferencesWithPdvId.pdvId ?? "UNDEFINED"
  ),
  userPDVId: retrievedServicePreferencesWithPdvId.pdvId ?? "UNDEFINED",
  settingsVersion: retrievedServicePreferencesWithPdvId.settingsVersion,
  serviceId: retrievedServicePreferencesWithPdvId.serviceId,
  isInboxEnabled: retrievedServicePreferencesWithPdvId.isInboxEnabled,
  isEmailEnabled: retrievedServicePreferencesWithPdvId.isEmailEnabled,
  isWebhookEnabled: retrievedServicePreferencesWithPdvId.isWebhookEnabled,
  accessReadMessageStatus:
    retrievedServicePreferencesWithPdvId.accessReadMessageStatus,
  // eslint-disable-next-line sort-keys, no-underscore-dangle
  timestamp: retrievedServicePreferencesWithPdvId._ts * 1000
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const servicePreferencesAvroFormatter = (): MessageFormatter<RetrievedServicePreferenceWithMaybePdvId> => servicePreferenceWithPdvId => {
  const avroObject = buildAvroServicePreferencesObject(
    servicePreferenceWithPdvId
  );

  return {
    // pdvId as Partition Key
    key: avroObject.userPDVId,
    value: avro.Type.forSchema(
      servicePreferences.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
    ).toBuffer(Object.assign(new servicePreferences(), avroObject))
  };
};
