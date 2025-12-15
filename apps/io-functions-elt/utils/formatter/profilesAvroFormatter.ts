import { PreferredLanguageEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/PreferredLanguage";
import * as avro from "avsc";

import { BlockedInboxOrChannelEnum } from "../../generated/avro/dto/BlockedInboxOrChannelEnumEnum";
import { profile } from "../../generated/avro/dto/profile";
import { PushNotificationsContentTypeEnum } from "../../generated/avro/dto/PushNotificationsContentTypeEnumEnum";
import { ReminderStatusEnum } from "../../generated/avro/dto/ReminderStatusEnumEnum";
import { MessageFormatter } from "../kafka/KafkaTypes";
import { RetrievedProfileWithMaybePdvId } from "../types/decoratedTypes";

// remove me
export const buildAvroProfileObject = (
  retrievedProfilesWithPdvId: RetrievedProfileWithMaybePdvId
): Omit<profile, "schema" | "subject"> => ({
  acceptedTosVersion:
    retrievedProfilesWithPdvId.acceptedTosVersion?.toString() ?? "UNSET",
  blockedInboxOrChannels:
    (retrievedProfilesWithPdvId.blockedInboxOrChannels as Record<
      string,
      BlockedInboxOrChannelEnum[]
    >) ?? {},
  id: retrievedProfilesWithPdvId.id.replace(
    retrievedProfilesWithPdvId.fiscalCode,
    retrievedProfilesWithPdvId.userPDVId ?? "UNDEFINED"
  ),
  isEmailEnabled: retrievedProfilesWithPdvId.isEmailEnabled ?? false,
  isEmailValidated: retrievedProfilesWithPdvId.isEmailValidated ?? false,
  isInboxEnabled: retrievedProfilesWithPdvId.isInboxEnabled ?? false,
  isWebhookEnabled: retrievedProfilesWithPdvId.isWebhookEnabled ?? false,
  lastAppVersion: retrievedProfilesWithPdvId.lastAppVersion ?? "UNKNOWN",
  preferredLanguages:
    (retrievedProfilesWithPdvId.preferredLanguages as PreferredLanguageEnum[]) ??
    [],
  pushNotificationsContentType:
    (retrievedProfilesWithPdvId.pushNotificationsContentType ??
      PushNotificationsContentTypeEnum.UNSET) as PushNotificationsContentTypeEnum,
  reminderStatus: (retrievedProfilesWithPdvId.reminderStatus ??
    ReminderStatusEnum.UNSET) as ReminderStatusEnum,
  servicePreferencesSettings:
    retrievedProfilesWithPdvId.servicePreferencesSettings,

  timestamp: retrievedProfilesWithPdvId._ts * 1000,
  userPDVId: retrievedProfilesWithPdvId.userPDVId ?? "UNDEFINED",
  version: retrievedProfilesWithPdvId.version
});

export const profilesAvroFormatter =
  (): MessageFormatter<RetrievedProfileWithMaybePdvId> =>
  (profileWithPdvId) => {
    const avroObject = buildAvroProfileObject(profileWithPdvId);

    return {
      // pdvId as Partition Key
      key: avroObject.userPDVId,
      value: avro.Type.forSchema(
        profile.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
      ).toBuffer(Object.assign(new profile(), avroObject))
    };
  };
