import { flow, identity, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as TS from "fp-ts/lib/These";
import * as T from "fp-ts/lib/Task";
import * as E from "fp-ts/lib/Either";
import * as RA from "fp-ts/ReadonlyArray";
import { Validation } from "io-ts";

import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import * as KP from "./kafka/KafkaProducerCompact";
import { IStorableSendFailureError } from "./kafka/KafkaOperation";
import { IBulkOperationResult } from "./bulkOperationResult";

import { TelemetryClient, trackException } from "./appinsights";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const kerr = require("kafkajs/src/errors.js"); // due to suspected issue "KafkaJsError is not a costructor" whe using kafkajs type

export const storeErrors = (queueClient: QueueClient) => (
  storableErrors: ReadonlyArray<IStorableSendFailureError<unknown>>
): TE.TaskEither<Error, ReadonlyArray<QueueSendMessageResponse>> =>
  pipe(
    storableErrors,
    RA.map(se =>
      TE.tryCatch(
        () =>
          queueClient.sendMessage(
            Buffer.from(JSON.stringify(se)).toString("base64")
          ),
        E.toError
      )
    ),
    RA.sequence(TE.ApplicativeSeq)
  );

const mapDecodingErrors = <T>(documents?: ReadonlyArray<unknown>) => (
  i: number,
  decodeResult: Validation<T>
): E.Either<IStorableSendFailureError<T>, T> =>
  pipe(
    decodeResult,
    E.mapLeft(errorsToReadableMessages),
    E.mapLeft(RA.reduce("", (errorsJoined, rde) => errorsJoined + " | " + rde)),
    E.mapLeft(errorsJoined => ({
      ...new kerr.KafkaJSError(errorsJoined, { retriable: false }),
      body: documents ? documents[i] : {}
    }))
  );

const retriables: <T>(
  errors: ReadonlyArray<IStorableSendFailureError<T>>
) => ReadonlyArray<IStorableSendFailureError<T>> = flow(
  RA.filter(e => e.retriable)
);

const notRetriables: <T>(
  errors: ReadonlyArray<IStorableSendFailureError<T>>
) => ReadonlyArray<IStorableSendFailureError<T>> = flow(
  RA.filter(e => !e.retriable)
);

const trackErrors = <T>(telemetryClient: TelemetryClient, name?: string) => (
  storableErrors: ReadonlyArray<IStorableSendFailureError<T>>
): T.Task<ReadonlyArray<IStorableSendFailureError<T>>> =>
  pipe(
    storableErrors,
    RA.map(error =>
      trackException(telemetryClient, {
        exception: error,
        properties: {
          detail: error.message,
          fatal: (!error.retriable).toString(),
          isSuccess: "false",
          name: name ?? "elt.publish.retry.failure"
        },
        tagOverrides: { samplingEnabled: String(error.retriable) }
      })
    ),
    () => T.of(storableErrors)
  );

const composeResult = <T>(documents?: ReadonlyArray<unknown>) => (
  errors: ReadonlyArray<IStorableSendFailureError<T>>
): IBulkOperationResult => ({
  isSuccess: errors.length === 0,
  result: `Documents sent ${(documents?.length ?? 0) -
    errors.length}. Retriable Errors: ${
    retriables(errors).length
  }. Not Retriable Errors: ${notRetriables(errors).length}.`
});

export const publish = <T>(
  client: KP.KafkaProducerCompact<T>,
  documents?: ReadonlyArray<unknown>
) => (
  inputs: ReadonlyArray<Validation<T>>
): T.Task<ReadonlyArray<IStorableSendFailureError<T>>> =>
  pipe(
    inputs,
    RA.mapWithIndex(mapDecodingErrors(documents)),
    is => TS.both(RA.lefts(is), RA.rights(is)),
    TS.map(KP.sendMessages(client)),
    TS.map(TE.map(() => [] as ReadonlyArray<IStorableSendFailureError<T>>)),
    TS.map(TE.toUnion),
    TS.mapLeft(T.of),
    TS.fold(identity, identity, (d, p) =>
      pipe([d, p], T.sequenceArray, T.map(RA.flatten))
    )
  );

export const publishOrStore = <T>(
  client: KP.KafkaProducerCompact<T>,
  queueClient: QueueClient,
  telemetryClient: TelemetryClient,
  documents?: ReadonlyArray<unknown>
) => (
  task: T.Task<ReadonlyArray<Validation<T>>>
): T.Task<IBulkOperationResult> =>
  pipe(
    task,
    T.chain(publish(client, documents)),
    T.chainFirst(flow(retriables, storeErrors(queueClient), TE.toUnion)),
    T.chainFirst(flow(notRetriables, trackErrors(telemetryClient))),
    T.map(composeResult(documents))
  );

export const publishOrThrow = <T>(
  client: KP.KafkaProducerCompact<T>,
  telemetryClient: TelemetryClient,
  documents?: ReadonlyArray<unknown>
) => (
  task: T.Task<ReadonlyArray<Validation<T>>>
): T.Task<IBulkOperationResult> =>
  pipe(
    task,
    T.chain(publish(client, documents)),
    T.chainFirst(
      flow(
        retriables,
        trackErrors(telemetryClient),
        T.map(
          RA.map(e => {
            throw e;
          })
        )
      )
    ),
    T.chainFirst(flow(notRetriables, trackErrors(telemetryClient))),
    T.map(composeResult(documents))
  );
