import { aRetrievedService, aService } from "../../__mocks__/services.mock";
import { QueueClient } from "@azure/storage-queue";
import { ProducerRecord, RecordMetadata } from "kafkajs";
import { handle } from "../handler";
import { TelemetryClient } from "applicationinsights";
import { mockProducerCompact } from "../../utils/kafka/__mocks__/KafkaProducerCompact";

const mockSendMessage = jest.fn(() => Promise.resolve());
const mockQueueClient = ({
  sendMessage: mockSendMessage
} as unknown) as QueueClient;

const mockTelemetryClient = ({
  trackException: jest.fn(_ => void 0)
} as unknown) as TelemetryClient;

const dummyProducerCompact = mockProducerCompact(aRetrievedService);

describe("handle test", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a working queue client, a working kafka producer and a valid service list WHEN publish is called THEN the publish return no errors and no error has been stored", async () => {
    const messages = [aRetrievedService];
    const response = await handle(
      messages,
      mockTelemetryClient,
      dummyProducerCompact.getClient,
      mockQueueClient
    );
    expect(response).toStrictEqual({
      isSuccess: true,
      result: "Documents sent 1. Retriable Errors: 0. Not Retriable Errors: 0."
    });
    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(0);
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a working queue client, a working kafka producer and a not valid service list WHEN publish is called THEN the publish return a decode error and the decode error is stored", async () => {
    const messages = [aService];
    const response = await handle(
      messages,
      mockTelemetryClient,
      dummyProducerCompact.getClient,
      mockQueueClient
    );
    expect(response).toStrictEqual({
      isSuccess: false,
      result: "Documents sent 0. Retriable Errors: 0. Not Retriable Errors: 1."
    });
    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(0);
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(1);
  });

  it("GIVEN a working queue client, a working kafka producer and a partially valid service list WHEN publish is called THEN the publish return a decode error and each decode errors are stored", async () => {
    const messages = [aService, aRetrievedService];
    const response = await handle(
      messages,
      mockTelemetryClient,
      dummyProducerCompact.getClient,
      mockQueueClient
    );
    expect(response).toStrictEqual({
      isSuccess: false,
      result: "Documents sent 1. Retriable Errors: 0. Not Retriable Errors: 1."
    });
    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(0);
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(1);
  });

  it("GIVEN a working queue client, a not working kafka producer and a valid service list WHEN publish is called THEN the publish return an error and the producer error is stored", async () => {
    dummyProducerCompact.producer.send.mockImplementationOnce(
      async (pr: ProducerRecord) => [
        {
          errorCode: 2, // a retriable error code
          partition: 1,
          topicName: pr.topic
        } as RecordMetadata
      ]
    );
    const messages = [aRetrievedService];
    const result = await handle(
      messages,
      mockTelemetryClient,
      dummyProducerCompact.getClient,
      mockQueueClient
    );
    expect(result).toStrictEqual({
      isSuccess: false,
      result: "Documents sent 0. Retriable Errors: 1. Not Retriable Errors: 0."
    });
    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(1);
  });
});
