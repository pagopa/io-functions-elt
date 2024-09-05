import * as RTE from "fp-ts/ReaderTaskEither";
import { INonNegativeIntegerTag } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  AccessReadMessageStatusEnum,
  RetrievedServicePreference
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";

import { getAnalyticsProcessorForDocuments } from "../analytics-publish-documents";

import { aFiscalCode } from "../../__mocks__/services.mock";
import {
  anError,
  getMainAdapter,
  mockGetPdvId,
  mockSendMessageViaTopic,
  getPdvIdEnricherAdapter,
  trackerAdapter,
  getFallbackAdapterWithFilter,
  aCosmosMetadata
} from "../__mocks__/processor.mock";
import {
  getEnricherFailureExpecter,
  getKafkaProducerFailureExpects,
  getSuccessValidListExpects
} from "../__mocks__/test-case";

// Data

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
    getSuccessValidListExpects(documents);
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
    getKafkaProducerFailureExpects(documents);
  });

  it("GIVEN a valid list of service preferences and a transient error on content enricher, WHEN processing the list, THEN send it to the queue", async () => {
    // Given
    mockGetPdvId.mockImplementationOnce(() => RTE.left(Error("an Error")));
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
    getEnricherFailureExpecter(documents);
  });
});
