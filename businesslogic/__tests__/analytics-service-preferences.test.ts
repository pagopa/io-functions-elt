import * as TE from "fp-ts/TaskEither";
import { INonNegativeIntegerTag } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  AccessReadMessageStatusEnum,
  RetrievedServicePreference
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";

import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";

import { getAnalyticsProcessorForDocuments } from "../analytics-publish-documents";

import { aFiscalCode } from "../../__mocks__/services.mock";
import { sha256 } from "../../utils/pdv";
import {
  anError,
  aTopic,
  getMainAdapter,
  mockGetPdvId,
  mockSendMessageViaQueue,
  mockSendMessageViaTopic,
  mockTrackException,
  getPdvIdEnricherAdapter,
  trackerAdapter,
  getFallbackAdapterWithFilter
} from "../__mocks__/processor.mock";

// Data

const aCosmosMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "xyz",
  _ts: 1
};

const aRetrievedServicePreferences: RetrievedServicePreference = {
  ...aCosmosMetadata,
  kind: "IRetrievedServicePreference",
  id: `${aFiscalCode}-anEnabledServiceId-0000000000000001` as NonEmptyString,
  fiscalCode: aFiscalCode,
  serviceId: "anEnabledServiceId" as NonEmptyString,
  isInboxEnabled: true,
  isEmailEnabled: true,
  isWebhookEnabled: true,
  accessReadMessageStatus: AccessReadMessageStatusEnum.DENY,
  settingsVersion: 1 as number & INonNegativeIntegerTag,
  _ts: 1637077231000
};
const aRetrievedServicePreferencesList = [
  aRetrievedServicePreferences,
  {
    ...aRetrievedServicePreferences,
    id: `${aFiscalCode}-anEnabledServiceId-0000000000000002` as NonEmptyString,
    settingsVersion: 2 as number & INonNegativeIntegerTag,
    _ts: 1637077231001
  }
];

// Tests

describe("publish", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a valid list of service preferences, WHEN processing the list, THEN publish it to the topic with enriched values", async () => {
    // Given
    const documents = aRetrievedServicePreferencesList;
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedServicePreference,
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

  it("GIVEN a valid list of service preferences and a not working Kafka Producer Client, WHEN processing the list, THEN send it to the queue", async () => {
    // Given
    mockSendMessageViaTopic.mockImplementationOnce(async () => {
      throw anError;
    });
    const documents = aRetrievedServicePreferencesList;
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedServicePreference,
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

  it("GIVEN a valid list of service preferences and a transient error on content enricher, WHEN processing the list, THEN send it to the queue", async () => {
    // Given
    mockGetPdvId.mockImplementationOnce(() => TE.left(Error("an Error")));
    const documents = aRetrievedServicePreferencesList;
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedServicePreference,
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
