import * as avro from "avsc";

import { servicePreferences } from "../../generated/avro/dto/servicePreferences";
import { MessageFormatter } from "../kafka/KafkaTypes";
import { RetrievedServicePreferenceWithMaybePdvId } from "../types/decoratedTypes";

// remove me
export const buildAvroServicePreferencesObject = (
  retrievedServicePreferencesWithPdvId: RetrievedServicePreferenceWithMaybePdvId
): Omit<servicePreferences, "schema" | "subject"> => ({
  accessReadMessageStatus:
    retrievedServicePreferencesWithPdvId.accessReadMessageStatus,
  id: retrievedServicePreferencesWithPdvId.id.replace(
    retrievedServicePreferencesWithPdvId.fiscalCode,
    retrievedServicePreferencesWithPdvId.userPDVId ?? "UNDEFINED"
  ),
  isEmailEnabled: retrievedServicePreferencesWithPdvId.isEmailEnabled,
  isInboxEnabled: retrievedServicePreferencesWithPdvId.isInboxEnabled,
  isWebhookEnabled: retrievedServicePreferencesWithPdvId.isWebhookEnabled,
  serviceId: retrievedServicePreferencesWithPdvId.serviceId,
  settingsVersion: retrievedServicePreferencesWithPdvId.settingsVersion,

  timestamp: retrievedServicePreferencesWithPdvId._ts * 1000,
  userPDVId: retrievedServicePreferencesWithPdvId.userPDVId ?? "UNDEFINED"
});

export const servicePreferencesAvroFormatter =
  (): MessageFormatter<RetrievedServicePreferenceWithMaybePdvId> =>
  (servicePreferenceWithPdvId) => {
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
