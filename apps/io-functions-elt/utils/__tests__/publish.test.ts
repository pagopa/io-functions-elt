import { TableClient } from "@azure/data-tables";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import * as E from "fp-ts/Either";
import * as KP from "../kafka/KafkaProducerCompact";
import * as RA from "fp-ts/ReadonlyArray";
import { pipe } from "fp-ts/lib/function";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { storeErrors, publish } from "../publish";
import { aRetrievedService, aService } from "../../__mocks__/services.mock";
import { IStorableSendFailureError } from "../kafka/KafkaOperation";
import {
  ValidableKafkaProducerConfig,
  KafkaProducerTopicConfig
} from "../kafka/KafkaTypes";
import { RecordMetadata } from "kafkajs";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const kerr = require("kafkajs/src/errors.js"); // due to suspected issue "KafkaJsError is not a costructor" whe using kafkajs type

vi.mock("@azure/data-tables");
vi.mock("../kafka/KafkaProducerCompact");

describe("storeErrors test", () => {
  beforeEach(() => vi.resetAllMocks());

  it("GIVEN a storable error and a working table client WHEN storeErrors is called THEN the storage table sdk is succesfully called", async () => {
    const errorStorage = new TableClient("dummy", "dummy");
    const response = await pipe(
      [new kerr.KafkaJSError("TEST")],
      storeErrors(errorStorage),
      RA.sequence(TE.ApplicativeSeq)
    )();
    expect(errorStorage.createEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "TEST",
        name: "KafkaJSError",
        partitionKey: `${new Date().getMonth() + 1}`,
        retriable: true
      })
    );
    expect(E.isRight(response)).toBeTruthy();
    if (E.isRight(response)) {
      expect(response.right.length).toBe(1);
    }
  });

  it("GIVEN a storable error and a not working table client WHEN storeErrors is called THEN the storage table sdk is un-succesfully called", async () => {
    const errorStorage = new TableClient("dummy", "dummy");
    (errorStorage.createEntity as Mock).mockImplementationOnce(
      async () => {
        throw new Error("TEST");
      }
    );
    const response = await pipe(
      [new kerr.KafkaJSError("TEST")],
      storeErrors(errorStorage),
      RA.sequence(TE.ApplicativeSeq)
    )();
    expect(E.isLeft(response)).toBeTruthy();
  });

  it("GIVEN a working table client, a working kafka producer and a valid service list WHEN publish is called THEN the publish return no errors and no error has been stored", async () => {
    const errorStorage = new TableClient("dummy", "dummy");
    const producer = KP.fromConfig(
      {} as ValidableKafkaProducerConfig,
      {} as KafkaProducerTopicConfig<RetrievedService>
    );
    const messages = [aRetrievedService];
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publish(producer, errorStorage, messages)
    )();
    expect(response).toStrictEqual({
      isSuccess: true,
      result: "Documents sent (1). No decoding errors."
    });
    expect(errorStorage.createEntity).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a working table client, a working kafka producer and a valid service list WHEN publish is called THEN the publish return no errors and no error has been stored", async () => {
    const errorStorage = new TableClient("dummy", "dummy");
    const producer = KP.fromConfig(
      {} as ValidableKafkaProducerConfig,
      {} as KafkaProducerTopicConfig<RetrievedService>
    );
    const messages = [aRetrievedService];
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publish(producer, errorStorage, messages)
    )();
    expect(response).toStrictEqual({
      isSuccess: true,
      result: "Documents sent (1). No decoding errors."
    });
    expect(errorStorage.createEntity).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a working table client, a working kafka producer and a not valid service list WHEN publish is called THEN the publish return a decode error and the decode error is stored", async () => {
    const errorStorage = new TableClient("dummy", "dummy");
    const producer = KP.fromConfig(
      {} as ValidableKafkaProducerConfig,
      {} as KafkaProducerTopicConfig<RetrievedService>
    );
    const messages = [aService];
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publish(producer, errorStorage, messages)
    )();
    expect(response).toStrictEqual({
      isSuccess: false,
      result:
        "Documents sent (0). Error decoding some documents. Check storage table errors for details."
    });
    expect(errorStorage.createEntity).toHaveBeenCalledTimes(1);
  });

  it("GIVEN a working table client, a working kafka producer and a partially valid service list WHEN publish is called THEN the publish return a decode error and each decode errors are stored", async () => {
    const errorStorage = new TableClient("dummy", "dummy");
    const producer = KP.fromConfig(
      {} as ValidableKafkaProducerConfig,
      {} as KafkaProducerTopicConfig<RetrievedService>
    );
    const messages = [aService, aRetrievedService];
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publish(producer, errorStorage, messages)
    )();
    expect(response).toStrictEqual({
      isSuccess: false,
      result:
        "Documents sent (1). Error decoding some documents. Check storage table errors for details."
    });
    expect(errorStorage.createEntity).toHaveBeenCalledTimes(1);
  });

  it("GIVEN a working table client, a not working kafka producer and a valid service list WHEN publish is called THEN the publish return an error and the producer error is stored", async () => {
    (KP as any).__setSendMessageError();
    const errorStorage = new TableClient("dummy", "dummy");
    const producer = KP.fromConfig(
      {} as ValidableKafkaProducerConfig,
      {} as KafkaProducerTopicConfig<RetrievedService>
    );
    const messages = [aRetrievedService];
    const response = await pipe(
      messages,
      RA.map(RetrievedService.decode),
      T.of,
      publish(producer, errorStorage, messages)
    )();
    expect(response).toStrictEqual({
      isSuccess: false,
      result:
        "Error publishing some documents. Check storage table errors for details. No decoding errors."
    });
    expect(errorStorage.createEntity).toHaveBeenCalledTimes(1);
  });
});
