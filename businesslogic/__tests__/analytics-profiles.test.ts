import { getAnalyticsProcessorForDocuments } from "../analytics-publish-documents";
import { anError, aTopic, mockKafkaPublisherAdapter, mockPersonalDataVaultEnricher, mockQueuePublisherAdapter, mockTrackerAdapter } from "../../__mocks__/adapters";
import { aRetrievedProfile, aToken } from "../../__mocks__/profiles.mock";
import { RetrievedProfileWithToken } from "../../utils/types/retrievedProfileWithToken";
import { readableReport, readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as RA from "fp-ts/ReadonlyArray";
import { identity, pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { ValidationError } from "io-ts";
import { SeverityLevel } from "../../outbound/port/outbound-tracker";

describe("publish", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a valid list of profiles, WHEN processing the list, THEN publish it to the topic", async () => {
    // Given
    const mockPdv = mockPersonalDataVaultEnricher();
    const trackerAdapter = mockTrackerAdapter();
    const mainAdapter = mockKafkaPublisherAdapter();
    const fallbackAdapter = mockQueuePublisherAdapter();
    const documents = [aRetrievedProfile];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedProfileWithToken,
      trackerAdapter.adapter,
      mockPdv.adapter,
      mainAdapter.adapter,
      fallbackAdapter.adapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockPdv.mockEnrichs).toHaveBeenCalledTimes(1);
    expect(mockPdv.mockEnrichs).toHaveBeenCalledWith(documents);
    expect(mainAdapter.kafkaProducer.mockSend).toHaveBeenCalledTimes(1);
    expect(mainAdapter.kafkaProducer.mockSend).toHaveBeenNthCalledWith(1, {
      messages: [
        {
          value: JSON.stringify({...documents[0], token: aToken})
        }
      ],
      topic: aTopic
    });
    expect(fallbackAdapter.queue.mockSendMessage).toHaveBeenCalledTimes(0);
    expect(fallbackAdapter.queue.mockSendMessage).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a not valid list of profiles, WHEN processing the list, THEN track the exception", async () => {
    // Given
    const mockPdv = mockPersonalDataVaultEnricher();
    const trackerAdapter = mockTrackerAdapter();
    const mainAdapter = mockKafkaPublisherAdapter();
    const fallbackAdapter = mockQueuePublisherAdapter();
    const documents = [{dummy: "dummy"}];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedProfileWithToken,
      trackerAdapter.adapter,
      mockPdv.adapter,
      mainAdapter.adapter,
      fallbackAdapter.adapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(trackerAdapter.applicationisight.mockTrackException).toHaveBeenCalledTimes(1);
    RA.mapWithIndex((i, document) =>
      expect(trackerAdapter.applicationisight.mockTrackException).toHaveBeenNthCalledWith(i + 1, {
        exception: pipe(
          document,
          RetrievedProfileWithToken.decode,
          E.fold(identity, () => {
            throw new Error("You should not be here!");
          }),
          e => (e as unknown) as ValidationError[],
          readableReport,
          message => new Error(message)
        ),
        severity: SeverityLevel.Error
      })
    )(documents);
    expect(fallbackAdapter.queue.mockSendMessage).toHaveBeenCalledTimes(0);
    expect(fallbackAdapter.queue.mockSendMessage).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of profiles and a not working Kafka Producer Client, WHEN processing the list, THEN send it to the queue", async () => {
    // Given
    const mockPdv = mockPersonalDataVaultEnricher();
    const trackerAdapter = mockTrackerAdapter();
    const mainAdapter = mockKafkaPublisherAdapter();
    const fallbackAdapter = mockQueuePublisherAdapter();
    const documents = [aRetrievedProfile];
    mainAdapter.kafkaProducer.mockSend.mockImplementation(async () => {
      throw anError;
    });
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedProfileWithToken,
      trackerAdapter.adapter,
      mockPdv.adapter,
      mainAdapter.adapter,
      fallbackAdapter.adapter
    );
    
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(fallbackAdapter.queue.mockSendMessage).toHaveBeenCalledTimes(1);
    pipe(
      documents,
      RA.mapWithIndex((i, document) =>
        expect(fallbackAdapter.queue.mockSendMessage).toHaveBeenNthCalledWith(
          i + 1,
          Buffer.from(
            JSON.stringify({
              ...document,
              kind: "IRetrievedProfile",
              token: aToken
            })
          ).toString("base64")
        )
      )
    );
    expect(mainAdapter.kafkaProducer.mockSend).toHaveBeenCalledTimes(1);
    expect(trackerAdapter.applicationisight.mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of profiles and both a not working Kafka Producer Client and a not working Queue Storage Client, WHEN processing the list, THEN throw an exception ", async () => {
    // Given
    const mockPdv = mockPersonalDataVaultEnricher();
    const trackerAdapter = mockTrackerAdapter();
    const mainAdapter = mockKafkaPublisherAdapter();
    const fallbackAdapter = mockQueuePublisherAdapter();
    mainAdapter.kafkaProducer.mockSend.mockImplementation(async () => {
      throw anError;
    });
    fallbackAdapter.queue.mockSendMessage.mockImplementation(async () => {
      throw anError;
    });
    const documents = [aRetrievedProfile];
    
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedProfileWithToken,
      trackerAdapter.adapter,
      mockPdv.adapter,
      mainAdapter.adapter,
      fallbackAdapter.adapter
    ); 
    // When
    const publishOrThrow = expect(processorAdapter.process(documents)());
    // Then
    await publishOrThrow.rejects.toThrow();
  });
});
