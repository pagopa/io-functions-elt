import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { aFiscalCode } from "../../__mocks__/services.mock";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { PreferredLanguageEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/PreferredLanguage";
import { ReminderStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ReminderStatus";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { PushNotificationsContentTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/PushNotificationsContentType";
import {
  AccessReadMessageStatusEnum,
  RetrievedServicePreference
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";

export const aTopic = "a-topic";
export const anError = new Error("An error");

export const aMockPdvId = "7f95058c-0cf4-400b-9b77-2cd18eaba0b0" as NonEmptyString;
export const aCosmosMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "xyz",
  _ts: 1
};

export const aKafkaResponse = {
  errorCode: 0,
  partition: 1,
  topicName: aTopic
};

export const aRetrievedProfile: RetrievedProfile = {
  ...aCosmosMetadata,
  kind: "IRetrievedProfile",
  id: `${aFiscalCode}-0000000000000002` as NonEmptyString,
  fiscalCode: aFiscalCode,
  isEmailEnabled: true,
  isEmailValidated: true,
  email: "an-email@email.com" as EmailString,
  acceptedTosVersion: 22,
  isInboxEnabled: true,
  isWebhookEnabled: true,
  preferredLanguages: [PreferredLanguageEnum.it_IT],
  pushNotificationsContentType: PushNotificationsContentTypeEnum.FULL,
  reminderStatus: ReminderStatusEnum.ENABLED,
  servicePreferencesSettings: {
    mode: ServicesPreferencesModeEnum.AUTO,
    version: 1 as NonNegativeInteger
  },
  version: 2 as NonNegativeInteger,
  isTestProfile: false,
  lastAppVersion: "10.1.1" as RetrievedProfile["lastAppVersion"],
  _ts: 1637077231000
};
export const aRetrievedProfileList = [
  aRetrievedProfile,
  {
    ...aRetrievedProfile,
    id: `${aFiscalCode}-0000000000000003` as NonEmptyString,
    version: 3 as NonNegativeInteger,
    _ts: 1637077231001
  }
];

export const aRetrievedServicePreferences: RetrievedServicePreference = {
  ...aCosmosMetadata,
  kind: "IRetrievedServicePreference",
  id: `${aFiscalCode}-anEnabledServiceId-0000000000000001` as NonEmptyString,
  fiscalCode: aFiscalCode,
  serviceId: "anEnabledServiceId" as NonEmptyString,
  isInboxEnabled: true,
  isEmailEnabled: true,
  isWebhookEnabled: true,
  accessReadMessageStatus: AccessReadMessageStatusEnum.DENY,
  settingsVersion: 1 as NonNegativeInteger,
  _ts: 1637077231000
};
export const aRetrievedServicePreferencesList = [
  aRetrievedServicePreferences,
  {
    ...aRetrievedServicePreferences,
    id: `${aFiscalCode}-anEnabledServiceId-0000000000000002` as NonEmptyString,
    settingsVersion: 2 as NonNegativeInteger,
    _ts: 1637077231001
  }
];
