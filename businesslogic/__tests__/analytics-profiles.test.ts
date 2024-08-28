import * as TE from "fp-ts/TaskEither";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";

import { getAnalyticsProcessorForDocuments } from "../analytics-publish-documents";

import { aFiscalCode } from "../../__mocks__/services.mock";
import { sha256 } from "../../utils/pdv";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { PreferredLanguageEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/PreferredLanguage";
import { ReminderStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ReminderStatus";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { PushNotificationsContentTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/PushNotificationsContentType";
import {
  mockGetPdvId,
  mockSendMessageViaQueue,
  mockSendMessageViaTopic,
  mockTrackException,
  trackerAdapter
} from "../__mocks__/processor.mock";
import {
  getPdvIdEnricherAdapter,
  getMainAdapter,
  getFallbackAdapterWithFilter
} from "../__mocks__/processor.mock";

// Data

const aTopic = "a-topic";
const anError = new Error("An error");

const aCosmosMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "xyz",
  _ts: 1
};

const aRetrievedProfile: RetrievedProfile = {
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
const aRetrievedProfileList = [
  aRetrievedProfile,
  {
    ...aRetrievedProfile,
    id: `${aFiscalCode}-0000000000000003` as NonEmptyString,
    version: 3 as NonNegativeInteger,
    _ts: 1637077231001
  }
];

// Tests

describe("publish", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a valid list of profiles, WHEN processing the list, THEN publish it to the topic with enriched values", async () => {
    // Given
    const documents = aRetrievedProfileList;
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedProfile,
      trackerAdapter,
      getPdvIdEnricherAdapter(),
      getMainAdapter(),
      getFallbackAdapterWithFilter()
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockGetPdvId).toHaveBeenCalledTimes(2);
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
    expect(mockSendMessageViaTopic).toHaveBeenCalledWith({
      messages: documents.map(document => ({
        value: JSON.stringify({
          ...document,
          // enriched values
          userPDVId: sha256(document.fiscalCode)
        })
      })),
      topic: aTopic
    });
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(0);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of profile and a not working Kafka Producer Client, WHEN processing the list, THEN send it to the queue", async () => {
    // Given
    mockSendMessageViaTopic.mockImplementationOnce(async () => {
      throw anError;
    });
    const documents = aRetrievedProfileList;
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedProfile,
      trackerAdapter,
      getPdvIdEnricherAdapter(),
      getMainAdapter(),
      getFallbackAdapterWithFilter()
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockGetPdvId).toHaveBeenCalledTimes(2);
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(2);
    pipe(
      documents,
      RA.mapWithIndex((i, document) =>
        expect(mockSendMessageViaQueue).toHaveBeenNthCalledWith(
          i + 1,
          Buffer.from(
            JSON.stringify({
              ...document
              // DO NOT store pdvId values
              // userPDVId: sha256(document.fiscalCode)
            })
          ).toString("base64")
        )
      )
    );
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of profiles and a transient error on content enricher, WHEN processing the list, THEN send it to the queue", async () => {
    // Given
    mockGetPdvId.mockImplementationOnce(() => TE.left(Error("an Error")));
    const documents = aRetrievedProfileList;
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedProfile,
      trackerAdapter,
      getPdvIdEnricherAdapter(),
      getMainAdapter(),
      getFallbackAdapterWithFilter()
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockGetPdvId).toHaveBeenCalledTimes(2);
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(1);
    pipe(
      [documents[0]],
      RA.mapWithIndex((i, document) =>
        expect(mockSendMessageViaQueue).toHaveBeenNthCalledWith(
          i + 1,
          Buffer.from(
            JSON.stringify({
              ...document
              // DO NOT store pdvId values
              // userPDVId: sha256(document.fiscalCode)
            })
          ).toString("base64")
        )
      )
    );
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });
});
