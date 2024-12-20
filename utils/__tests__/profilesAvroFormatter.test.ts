import {
  buildAvroProfileObject,
  profilesAvroFormatter
} from "../formatter/profilesAvroFormatter";
import { aFiscalCode } from "../../__mocks__/services.mock";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import * as avro from "avsc";
import { profile } from "../../generated/avro/dto/profile";
import { PushNotificationsContentTypeEnum } from "../../generated/avro/dto/PushNotificationsContentTypeEnumEnum";
import { ReminderStatusEnum } from "../../generated/avro/dto/ReminderStatusEnumEnum";
import { aCosmosMetadata } from "../../businesslogic/__mocks__/data.mock";
import { RetrievedProfileWithMaybePdvId } from "../types/decoratedTypes";

const aUserPDVId = "7f97bf94-6f41-4e8c-97a3-d496125374c0" as NonEmptyString;
const aRetrievedProfile: RetrievedProfileWithMaybePdvId = {
  ...aCosmosMetadata,
  kind: "IRetrievedProfile",
  id: `${aFiscalCode}-0000000000000002` as NonEmptyString,
  fiscalCode: aFiscalCode,
  servicePreferencesSettings: {
    mode: ServicesPreferencesModeEnum.LEGACY,
    version: -1
  },
  version: 1 as NonNegativeInteger,
  _ts: 1637077231000,
  userPDVId: aUserPDVId
};
describe("profileAvroFromatter", () => {
  it("should serialize a valid profile with defaults", async () => {
    const formatter = profilesAvroFormatter();

    const avroFormattedValue = formatter(aRetrievedProfile);
    const dtoExpected = buildAvroProfileObject(aRetrievedProfile);

    const serviceSchema = avro.Type.forSchema(profile.schema as avro.Schema);

    const decodedValue = serviceSchema.fromBuffer(
      avroFormattedValue.value as Buffer
    );

    expect(decodedValue).toEqual(dtoExpected);
    expect(decodedValue).toEqual(
      expect.objectContaining({
        id: aRetrievedProfile.id.replace(
          aRetrievedProfile.fiscalCode,
          aUserPDVId
        ),
        userPDVId: aUserPDVId,
        // eslint-disable-next-line no-underscore-dangle
        timestamp: aRetrievedProfile._ts * 1000,
        acceptedTosVersion: "UNSET",
        isEmailEnabled: false,
        isEmailValidated: false,
        isInboxEnabled: false,
        isWebhookEnabled: false,
        lastAppVersion: "UNKNOWN",
        preferredLanguages: [],
        pushNotificationsContentType: PushNotificationsContentTypeEnum.UNSET,
        reminderStatus: ReminderStatusEnum.UNSET
      })
    );
  });

  it.each`
    booleanPropertyName
    ${"isEmailEnabled"}
    ${"isEmailValidated"}
    ${"isInboxEnabled"}
    ${"isWebhookEnabled"}
  `(
    "should serialize boolean properties correctly avoid property confusion on $booleanPropertyName",
    ({ booleanPropertyName }) => {
      const formatter = profilesAvroFormatter();

      const avroFormattedValue = formatter({
        ...aRetrievedProfile,
        [booleanPropertyName]: true
      });
      const dtoExpected = buildAvroProfileObject({
        ...aRetrievedProfile,
        [booleanPropertyName]: true
      });

      const serviceSchema = avro.Type.forSchema(profile.schema as avro.Schema);

      const decodedValue = serviceSchema.fromBuffer(
        avroFormattedValue.value as Buffer
      );

      expect(decodedValue).toEqual(dtoExpected);
      expect(decodedValue).toEqual(
        expect.objectContaining({
          isEmailEnabled: false,
          isEmailValidated: false,
          isInboxEnabled: false,
          isWebhookEnabled: false,
          [booleanPropertyName]: true
        })
      );
    }
  );
});
