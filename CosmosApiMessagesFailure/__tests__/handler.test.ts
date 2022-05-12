import * as t from "io-ts";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { handle } from "../handler";
import {
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { pipe } from "fp-ts/lib/function";
import { QueueClient } from "@azure/storage-queue";
import { TelemetryClient } from "../../utils/appinsights";
import { mockProducerCompact } from "../../utils/kafka/__mocks__/KafkaProducerCompact";
import {
  aGenericContent,
  aRetrievedMessage,
  aRetrievedMessageWithoutContent
} from "../../__mocks__/messages.mock";
import { ProducerRecord, RecordMetadata } from "kafkajs";

// ----------------------
// Variables
// ----------------------

const aListOfRightMessages = pipe(
  Array.from({ length: 10 }, i => aRetrievedMessageWithoutContent),
  t.array(RetrievedMessage).decode,
  E.getOrElseW(() => {
    throw Error();
  })
);

// ----------------------
// Mocks
// ----------------------

const getContentFromBlobMock = jest
  .fn()
  .mockImplementation(() => TE.of(O.some(aGenericContent)));

const mockMessageModel = ({
  getContentFromBlob: getContentFromBlobMock
} as any) as MessageModel;

const dummyProducerCompact = mockProducerCompact(aRetrievedMessage);

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
      aListOfRightMessages,
      mockTelemetryClient,
      mockMessageModel,
      {} as any,
      dummyProducerCompact.getClient
    );

    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(
      aListOfRightMessages.length
    );

    expect(mockQueueClient.sendMessage).not.toHaveBeenCalled();
    expect(res).toMatchObject(
      expect.objectContaining({
        isSuccess: true,
        result: `Documents sent ${aListOfRightMessages.length}. Retriable Errors: 0. Not Retriable Errors: 0.`
      })
    );
  });

  it("should enrich only non-pending messages", async () => {
    const res = await handle(
      aListOfRightMessages.map(m => ({
        ...m,
        isPending: true
      })),
      mockTelemetryClient,
      mockMessageModel,
      {} as any,
      dummyProducerCompact.getClient
    );

    expect(mockMessageModel.getContentFromBlob).not.toHaveBeenCalled();

    expect(mockQueueClient.sendMessage).not.toHaveBeenCalled();
    expect(res).toMatchObject(
      expect.objectContaining({
        isSuccess: true,
        result: `Documents sent ${aListOfRightMessages.length}. Retriable Errors: 0. Not Retriable Errors: 0.`
      })
    );
  });
});

describe("CosmosApiMessagesChangeFeed - Errors", () => {
  it.each`
    getContentResult
    ${TE.left(Error("An error occurred"))}
    ${TE.of(O.none)}
  `(
    "should not enqueue error if a content cannot be retrieved",
    async ({ getContentResult }) => {
      getContentFromBlobMock.mockImplementationOnce(() => getContentResult);

      const res = await handle(
        aListOfRightMessages,
        mockTelemetryClient,
        mockMessageModel,
        {} as any,
        dummyProducerCompact.getClient
      );

      expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(
        aListOfRightMessages.length
      );

      expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(0);
      expect(res).toMatchObject(
        expect.objectContaining({
          isSuccess: true
        })
      );
    }
  );

  it("should send only decoded retrieved messages", async () => {
    const res = await handle(
      [...aListOfRightMessages, { error: "error" }],
      mockTelemetryClient,
      mockMessageModel,
      {} as any,
      dummyProducerCompact.getClient
    );

    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(
      aListOfRightMessages.length
    );

    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(0);
    expect(res).toMatchObject(
      expect.objectContaining({
        isSuccess: false,
        result: `Documents sent ${aListOfRightMessages.length}. Retriable Errors: 0. Not Retriable Errors: 1.`
      })
    );
  });

  it("should throw an Error if storeMessageErrors fails", async () => {
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
        [...aListOfRightMessages, { error: "error" }],
        mockTelemetryClient,
        mockMessageModel,
        {} as any,
        dummyProducerCompact.getClient
      )
    ).rejects.toEqual(
      expect.objectContaining({
        retriable: true,
        name: "KafkaJSProtocolError",
        body: expect.anything()
      })
    );

    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(
      aListOfRightMessages.length
    );

    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(0);
  });
});
