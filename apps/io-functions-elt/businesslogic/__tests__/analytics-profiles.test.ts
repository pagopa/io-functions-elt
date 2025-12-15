import * as RTE from "fp-ts/ReaderTaskEither";
import { getAnalyticsProcessorForDocuments } from "../analytics-publish-documents";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  mockGetPdvId,
  mockSendMessageViaTopic,
  trackerAdapter
} from "../__mocks__/processor.mock";
import {
  getPdvIdEnricherAdapter,
  getMainAdapter,
  getFallbackAdapterWithFilter
} from "../__mocks__/processor.mock";
import {
  getEnricherFailureExpecter,
  getKafkaProducerFailureExpects,
  getSuccessValidListExpects
} from "../__mocks__/test-case";
import { anError, aRetrievedProfileList } from "../__mocks__/data.mock";
import { beforeEach, describe, it, vi } from "vitest";

// Tests

describe("publish", () => {
  beforeEach(() => vi.clearAllMocks());

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
    getSuccessValidListExpects(documents);
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
    getKafkaProducerFailureExpects(documents);
  });

  it("GIVEN a valid list of profiles and a transient error on content enricher, WHEN processing the list, THEN send it to the queue", async () => {
    // Given
    mockGetPdvId.mockReturnValueOnce(RTE.left(Error("an Error")));
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
    getEnricherFailureExpecter(documents);
  });
});
