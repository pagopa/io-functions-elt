import * as RA from "fp-ts/ReadonlyArray";
import { handle } from "../handler";
import { QueueClient } from "@azure/storage-queue";
import { TelemetryClient } from "../../utils/appinsights";
import { mockProducerCompact } from "../../utils/kafka/__mocks__/KafkaProducerCompact";
import { ProducerRecord, RecordMetadata } from "kafkajs";
import { aRetrievedMessageStatus } from "../../__mocks__/messages.mock";

// ----------------------
// Mocks
// ----------------------

const dummyProducerCompact = mockProducerCompact(aRetrievedMessageStatus);

const mockSendMessage = jest.fn(() => Promise.resolve());
const mockQueueClient = ({
  sendMessage: mockSendMessage
} as unknown) as QueueClient;

const mockTelemetryClient = ({
  trackException: jest.fn(_ => void 0)
} as unknown) as TelemetryClient;

// ----------------------
// Tests
// ----------------------

beforeEach(() => jest.clearAllMocks());

describe("CosmosApiMessagesChangeFeed", () => {
  it("should send all retrieved messages", async () => {
    const res = await handle(
      RA.replicate(10, aRetrievedMessageStatus),
      mockTelemetryClient,
      dummyProducerCompact.getClient
    );

    expect(mockQueueClient.sendMessage).not.toHaveBeenCalled();
    expect(res).toMatchObject(
      expect.objectContaining({
        isSuccess: true,
        result: `Documents sent 10. Retriable Errors: 0. Not Retriable Errors: 0.`
      })
    );
  });

  it("should send only decoded retrieved messages", async () => {
    const res = await handle(
      [...RA.replicate(10, aRetrievedMessageStatus), { error: "error" }],
      mockTelemetryClient,
      dummyProducerCompact.getClient
    );

    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(0);
    expect(res).toMatchObject(
      expect.objectContaining({
        isSuccess: false,
        result: `Documents sent 10. Retriable Errors: 0. Not Retriable Errors: 1.`
      })
    );
  });

  it("should throw an Error if send message fails", async () => {
    dummyProducerCompact.producer.send.mockImplementationOnce(
      async (pr: ProducerRecord) => [
        {
          errorCode: 2, // a retriable error code
          partition: 1,
          topicName: pr.topic
        } as RecordMetadata
      ]
    );

    await expect(
      handle(
        [...RA.replicate(10, aRetrievedMessageStatus), { error: "error" }],
        mockTelemetryClient,
        dummyProducerCompact.getClient
      )
    ).rejects.toEqual(
      expect.objectContaining({
        retriable: true,
        name: "KafkaJSProtocolError",
        body: expect.anything()
      })
    );

    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(0);
  });
});
