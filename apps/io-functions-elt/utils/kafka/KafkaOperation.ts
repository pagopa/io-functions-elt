/* eslint-disable @typescript-eslint/no-require-imports */
import * as E from "fp-ts/Either";
import { identity, pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import {
  Consumer,
  KafkaJSError,
  KafkaJSProtocolError,
  Producer,
  RecordMetadata
} from "kafkajs";
const kerr = require("kafkajs/src/errors.js"); // due to suspected issue "KafkaJsError is not a costructor" whe using kafkajs type
const { createErrorFromCode, failure } = require("kafkajs/src/protocol/error"); // import required becouse createErrorFromRecord is not included in @types/kafkajs

export interface IStorableSendFailureError<T> extends KafkaJSError {
  readonly body: T;
}

export const connect = (
  client: Consumer | Producer
): TE.TaskEither<Error, void> => TE.tryCatch(client.connect, E.toError);

export const disconnect = (
  client: Consumer | Producer
): TE.TaskEither<Error, void> => TE.tryCatch(client.disconnect, E.toError);

export const disconnectWithoutError = (
  client: Consumer | Producer
): TE.TaskEither<never, void> =>
  pipe(
    client,
    disconnect,
    TE.orElseW(() => TE.right(undefined))
  );

export const processErrors = <T>(
  messages: readonly T[],
  records: readonly RecordMetadata[]
): TE.TaskEither<
  readonly IStorableSendFailureError<T>[],
  readonly RecordMetadata[]
> =>
  pipe(
    records,
    RA.filter((r) => failure(r.errorCode)),
    RA.mapWithIndex((i, record) => ({
      ...(createErrorFromCode(record.errorCode) as KafkaJSProtocolError), // cast required becouse createErrorFromRecord is not included in @types/kafkajs
      body: messages[i]
    })),
    TE.fromPredicate((rs) => rs.length === 0, identity),
    TE.map(() => records)
  );

const isKafkaJSError = (error: Error): error is KafkaJSError =>
  "message" in error && "name" in error && "retriable" in error;

export const storableSendFailureError = <T>(
  error: unknown,
  messages: readonly T[]
): readonly IStorableSendFailureError<T>[] =>
  pipe(
    error,
    E.toError,
    E.fromPredicate(
      isKafkaJSError,
      (e) => new kerr.KafkaJSError(e, { retriable: false })
    ),
    E.toUnion,
    (ke: KafkaJSError) => messages.map((message) => ({ ...ke, body: message }))
  );
