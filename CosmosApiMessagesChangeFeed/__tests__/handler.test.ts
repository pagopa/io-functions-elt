import * as t from "io-ts";

import * as O from "fp-ts/lib/Option";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";

import { handleMessageChange } from "../handler";
import {
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { Producer, ProducerRecord, RecordMetadata } from "kafkajs";
import { KafkaProducerCompact } from "../../utils/kafka/KafkaProducerCompact";
import { pipe } from "fp-ts/lib/function";
import { TableClient, TableInsertEntityHeaders } from "@azure/data-tables";
import {
  aGenericContent,
  aRetrievedMessageWithoutContent
} from "../../__mocks__/messages.mock";
import { functionsContextMock } from "../../__mocks__/@azure/context.mock";

// ----------------------
// Variables
// ----------------------

const topic = "aTopic";

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

const producerMock = {
  connect: jest.fn(async () => void 0),
  disconnect: jest.fn(async () => void 0),
  send: jest.fn(async (pr: ProducerRecord) =>
    pipe(
      pr.messages,
      RA.map(
        __ =>
          ({
            errorCode: 0,
            partition: 1,
            topicName: pr.topic
          } as RecordMetadata)
      )
    )
  ),
  sendBatch: jest.fn(async _ => {
    [] as ReadonlyArray<RecordMetadata>;
  })
};

const mockKafkaProducerKompact: KafkaProducerCompact<RetrievedMessage> = () => ({
  producer: (producerMock as unknown) as Producer,
  topic: { topic }
});

const createEntityMock = jest.fn(
  async (_entity, _options) => ({} as TableInsertEntityHeaders)
);
const tableClient: TableClient = ({
  createEntity: createEntityMock
} as unknown) as TableClient;

// ----------------------
// Tests
// ----------------------

beforeEach(() => jest.clearAllMocks());

describe("CosmosApiMessagesChangeFeed", () => {
  it("should send all retrieved messages", async () => {
    const handler = handleMessageChange(
      functionsContextMock,
      mockMessageModel,
      {} as any
    );

    const res = await handler(
      mockKafkaProducerKompact,
      tableClient,
      aListOfRightMessages
    );

    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(
      aListOfRightMessages.length
    );

    expect(tableClient.createEntity).not.toHaveBeenCalled();
    expect(functionsContextMock.log.error).not.toHaveBeenCalled();

    expect(res).toMatchObject(
      expect.objectContaining({
        isSuccess: true,
        result: `Documents sent (${aListOfRightMessages.length}). No decoding errors.`
      })
    );
  });

  it("should enrich only non-pending messages", async () => {
    const handler = handleMessageChange(
      functionsContextMock,
      mockMessageModel,
      {} as any
    );

    const res = await handler(
      mockKafkaProducerKompact,
      tableClient,
      aListOfRightMessages.map(m => ({
        ...m,
        isPending: true
      }))
    );

    expect(mockMessageModel.getContentFromBlob).not.toHaveBeenCalled();

    expect(tableClient.createEntity).not.toHaveBeenCalled();
    expect(functionsContextMock.log.error).not.toHaveBeenCalled();

    expect(res).toMatchObject(
      expect.objectContaining({
        isSuccess: true,
        result: `Documents sent (${aListOfRightMessages.length}). No decoding errors.`
      })
    );
  });
});

describe("CosmosApiMessagesChangeFeed - Errors", () => {
  it.each`
    getContentResult                       | retriable
    ${TE.left(Error("An error occurred"))} | ${true}
    ${TE.of(O.none)}                       | ${false}
  `(
    "should store error if a content cannot be retrieved",
    async ({ getContentResult, retriable }) => {
      getContentFromBlobMock.mockImplementationOnce(() => getContentResult);

      const handler = handleMessageChange(
        functionsContextMock,
        mockMessageModel,
        {} as any
      );

      const res = await handler(
        mockKafkaProducerKompact,
        tableClient,
        aListOfRightMessages
      );

      expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(
        aListOfRightMessages.length
      );

      expect(tableClient.createEntity).toHaveBeenCalledTimes(1);
      expect(tableClient.createEntity).toHaveBeenCalledWith({
        body: `${JSON.stringify(aListOfRightMessages[0])}`,
        message: `Message ${aListOfRightMessages[0].id}: ${
          retriable ? "An error occurred" : "Message content not found"
        }`,
        name: "Message Error",
        partitionKey: `${new Date().getMonth() + 1}`,
        rowKey: expect.stringMatching(
          `${Date.now()
            .toString()
            .substring(0, 11)}`
        ),
        retriable
      });

      expect(functionsContextMock.log.error).toHaveBeenCalledTimes(1);

      expect(res).toMatchObject(
        expect.objectContaining({
          isSuccess: true,
          result: `Documents sent (${aListOfRightMessages.length -
            1}). No decoding errors.`
        })
      );
    }
  );

  it("should send only decoded retrieved messages", async () => {
    const handler = handleMessageChange(
      functionsContextMock,
      mockMessageModel,
      {} as any
    );

    const res = await handler(mockKafkaProducerKompact, tableClient, [
      ...aListOfRightMessages,
      { error: "error" }
    ]);

    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(
      aListOfRightMessages.length
    );

    expect(tableClient.createEntity).toHaveBeenCalledTimes(1);
    expect(functionsContextMock.log.error).not.toHaveBeenCalled();

    expect(res).toMatchObject(
      expect.objectContaining({
        isSuccess: false,
        result: `Documents sent (${aListOfRightMessages.length}). Error decoding some documents. Check storage table errors for details.`
      })
    );
  });

  it("should throw an Error if storeMessageErrors fails", async () => {
    const handler = handleMessageChange(
      functionsContextMock,
      mockMessageModel,
      {} as any
    );

    getContentFromBlobMock.mockImplementationOnce(() =>
      TE.left(Error("An error occurred"))
    );

    createEntityMock.mockImplementationOnce(async () => {
      throw Error("An error");
    });

    await expect(
      handler(mockKafkaProducerKompact, tableClient, [
        ...aListOfRightMessages,
        { error: "error" }
      ])
    ).rejects.toEqual(Error("An error"));

    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(
      aListOfRightMessages.length
    );

    expect(tableClient.createEntity).toHaveBeenCalledTimes(1);
    expect(functionsContextMock.log.error).toHaveBeenCalledTimes(2);
  });
});
