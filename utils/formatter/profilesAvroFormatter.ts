/* eslint-disable sort-keys */
import * as avro from "avsc";
import { PreferredLanguageEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/PreferredLanguage";
import { MessageFormatter } from "../kafka/KafkaTypes";
import { profile } from "../../generated/avro/dto/profile";
import { RetrievedProfileWithMaybePdvId } from "../../AnalyticsProfilesChangeFeedInboundProcessorAdapter";
import { PushNotificationsContentTypeEnum } from "../../generated/avro/dto/PushNotificationsContentTypeEnumEnum";
import { ReminderStatusEnum } from "../../generated/avro/dto/ReminderStatusEnumEnum";
import { BlockedInboxOrChannelEnum } from "../../generated/avro/dto/BlockedInboxOrChannelEnumEnum";

// remove me
export const buildAvroProfileObject = (
  retrievedProfilesWithPdvId: RetrievedProfileWithMaybePdvId
): Omit<profile, "schema" | "subject"> => ({
  id: retrievedProfilesWithPdvId.id.replace(
    retrievedProfilesWithPdvId.fiscalCode,
    retrievedProfilesWithPdvId.userPDVId ?? "UNDEFINED"
  ),
  userPDVId: retrievedProfilesWithPdvId.userPDVId ?? "UNDEFINED",
  // eslint-disable-next-line no-underscore-dangle
  timestamp: retrievedProfilesWithPdvId._ts * 1000,
  acceptedTosVersion:
    retrievedProfilesWithPdvId.acceptedTosVersion?.toString() ?? "UNSET",
  blockedInboxOrChannels:
    (retrievedProfilesWithPdvId.blockedInboxOrChannels as {
      // eslint-disable-next-line functional/prefer-readonly-type
      [index: string]: BlockedInboxOrChannelEnum[];
    }) ?? {},
  isEmailEnabled: retrievedProfilesWithPdvId.isEmailEnabled ?? false,
  isEmailValidated: retrievedProfilesWithPdvId.isEmailValidated ?? false,
  isInboxEnabled: retrievedProfilesWithPdvId.isInboxEnabled ?? false,
  isWebhookEnabled: retrievedProfilesWithPdvId.isWebhookEnabled ?? false,
  lastAppVersion: retrievedProfilesWithPdvId.lastAppVersion ?? "UNKNOWN",
  preferredLanguages:
    // eslint-disable-next-line functional/prefer-readonly-type
    (retrievedProfilesWithPdvId.preferredLanguages as PreferredLanguageEnum[]) ??
    [],
  pushNotificationsContentType: (retrievedProfilesWithPdvId.pushNotificationsContentType ??
    PushNotificationsContentTypeEnum.UNSET) as PushNotificationsContentTypeEnum,
  reminderStatus: (retrievedProfilesWithPdvId.reminderStatus ??
    ReminderStatusEnum.UNSET) as ReminderStatusEnum,
  servicePreferencesSettings:
    retrievedProfilesWithPdvId.servicePreferencesSettings,
  version: retrievedProfilesWithPdvId.version
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const profilesAvroFormatter = (): MessageFormatter<RetrievedProfileWithMaybePdvId> => profileWithPdvId => {
  const avroObject = buildAvroProfileObject(profileWithPdvId);

  return {
    // pdvId as Partition Key
    key: avroObject.userPDVId,
    value: avro.Type.forSchema(
      profile.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
    ).toBuffer(Object.assign(new profile(), avroObject))
  };
};
