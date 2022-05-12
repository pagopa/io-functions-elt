import * as T from "fp-ts/Task";
import * as E from "fp-ts/Either";
import * as KP from "../kafka/KafkaProducerCompact";
import * as RA from "fp-ts/ReadonlyArray";
import { pipe } from "fp-ts/lib/function";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { storeErrors, publishOrStore, publishOrThrow } from "../publish";
import { aRetrievedService, aService } from "../../__mocks__/services.mock";
import { QueueClient } from "@azure/storage-queue";
import { TelemetryClient } from "../appinsights";
import { ProducerRecord, RecordMetadata, Producer } from "kafkajs";
import { mockProducerCompact } from "../kafka/__mocks__/KafkaProducerCompact";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const kerr = require("kafkajs/src/errors.js"); // due to suspected issue "KafkaJsError is not a costructor" whe using kafkajs type

const aStorableError = new kerr.KafkaJSError("ERROR!");

const mockQueueClient = ({
  sendMessage: jest.fn(() => Promise.resolve())
} as unknown) as QueueClient;

const mockTelemetryClient = ({
  trackException: jest.fn(_ => void 0)
} as unknown) as TelemetryClient;

const dummyProducerCompact = mockProducerCompact(aRetrievedService);

describe("storeErrors test", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a storable error and a working queue client WHEN storeErrors is called THEN the storage queue sdk is succesfully called", async () => {
    const response = await pipe(
      [aStorableError],
      storeErrors(mockQueueClient)
    )();

    expect(mockQueueClient.sendMessage).toHaveBeenCalledWith(
      Buffer.from(JSON.stringify(aStorableError)).toString("base64")
    );
    expect(E.isRight(response)).toBeTruthy();
    if (E.isRight(response)) {
      expect(response.right.length).toBe(1);
    }
  });

  it("GIVEN a storable error and a not working queue client WHEN storeErrors is called THEN the storage queue sdk is un-succesfully called", async () => {
    const mockBrokenQueueClient = ({
      sendMessage: jest.fn(() => Promise.reject("ERROR!"))
    } as unknown) as QueueClient;

    const response = await pipe(
      [aStorableError],
      storeErrors(mockBrokenQueueClient)
    )();
    expect(E.isLeft(response)).toBeTruthy();
  });
});

describe("publishOrStore test", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a working queue client, a working kafka producer and a valid service list WHEN publish is called THEN the publish return no errors and no error has been stored", async () => {
    const messages = [aRetrievedService];
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publishOrStore(
        dummyProducerCompact.getClient,
        mockQueueClient,
        mockTelemetryClient,
        messages
      )
    )();
    expect(response).toStrictEqual({
      isSuccess: true,
      result: "Documents sent 1. Retriable Errors: 0. Not Retriable Errors: 0."
    });
    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(0);
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a working queue client, a working kafka producer and a not valid service list WHEN publish is called THEN the publish return a decode error and the decode error is stored", async () => {
    const messages = [aService];
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publishOrStore(
        dummyProducerCompact.getClient,
        mockQueueClient,
        mockTelemetryClient,
        messages
      )
    )();
    expect(response).toStrictEqual({
      isSuccess: false,
      result: "Documents sent 0. Retriable Errors: 0. Not Retriable Errors: 1."
    });
    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(0);
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(1);
  });

  it("GIVEN a working queue client, a working kafka producer and a partially valid service list WHEN publish is called THEN the publish return a decode error and each decode errors are stored", async () => {
    const messages = [aService, aRetrievedService];
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publishOrStore(
        dummyProducerCompact.getClient,
        mockQueueClient,
        mockTelemetryClient,
        messages
      )
    )();
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
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publishOrStore(
        dummyProducerCompact.getClient,
        mockQueueClient,
        mockTelemetryClient,
        messages
      )
    )();
    expect(response).toStrictEqual({
      isSuccess: false,
      result: "Documents sent 0. Retriable Errors: 1. Not Retriable Errors: 0."
    });
    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(1);
  });
});

describe("publishOrThrow test", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a working kafka producer and a valid service list WHEN publish is called THEN the publish return no errors and no error has been stored", async () => {
    const messages = [aRetrievedService];
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publishOrThrow(
        dummyProducerCompact.getClient,
        mockTelemetryClient,
        messages
      )
    )();
    expect(response).toStrictEqual({
      isSuccess: true,
      result: "Documents sent 1. Retriable Errors: 0. Not Retriable Errors: 0."
    });
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a working kafka producer and a not valid service list WHEN publish is called THEN the publish return a decode error and the decode error is stored", async () => {
    const messages = [aService];
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publishOrThrow(
        dummyProducerCompact.getClient,
        mockTelemetryClient,
        messages
      )
    )();
    expect(response).toStrictEqual({
      isSuccess: false,
      result: "Documents sent 0. Retriable Errors: 0. Not Retriable Errors: 1."
    });
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(1);
  });

  it("GIVEN a working kafka producer and a partially valid service list WHEN publish is called THEN the publish return a decode error and each decode errors are stored", async () => {
    const messages = [aService, aRetrievedService];
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publishOrThrow(
        dummyProducerCompact.getClient,
        mockTelemetryClient,
        messages
      )
    )();
    expect(response).toStrictEqual({
      isSuccess: false,
      result: "Documents sent 1. Retriable Errors: 0. Not Retriable Errors: 1."
    });
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(1);
  });

  it("GIVEN a not working kafka producer and a valid service list WHEN publish is called THEN the publish throw an error", async () => {
    dummyProducerCompact.producer.send.mockImplementationOnce(
      async (pr: ProducerRecord) =>
        RA.replicate(2, {
          errorCode: 2, // a retriable error code
          partition: 1,
          topicName: pr.topic
        })
    );
    const messages = [aRetrievedService, aRetrievedService];
    const responseTask = pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publishOrThrow(
        dummyProducerCompact.getClient,
        mockTelemetryClient,
        messages
      )
    );
    await expect(responseTask()).rejects.toEqual(
      expect.objectContaining({ body: aRetrievedService })
    );
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(2);
  });
});
