import * as RTE from "fp-ts/ReaderTaskEither";
import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { getAnalyticsProcessorForDocuments } from "../analytics-publish-documents";
import {
  getMainAdapter,
  mockGetPdvId,
  mockSendMessageViaTopic,
  getPdvIdEnricherAdapter,
  trackerAdapter,
  getFallbackAdapterWithFilter
} from "../__mocks__/processor.mock";
import {
  getEnricherFailureExpecter,
  getKafkaProducerFailureExpects,
  getSuccessValidListExpects
} from "../__mocks__/test-case";
import {
  anError,
  aRetrievedServicePreferencesList
} from "../__mocks__/data.mock";
import { beforeEach, describe, it, vi } from "vitest";

// Tests

describe("publish", () => {
  beforeEach(() => vi.clearAllMocks());

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
