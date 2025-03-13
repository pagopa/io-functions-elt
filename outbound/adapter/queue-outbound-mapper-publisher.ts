import { QueueClient } from "@azure/storage-queue";
import * as E from "fp-ts/Either";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";

import {
  Failure,
  OutboundPublisher,
  Success
} from "../port/outbound-publisher";

export const create = <I, T extends I>(
  map: (x: T) => I,
  producer: QueueClient
): OutboundPublisher<T> => {
  const sendOneMessage = (document: T): TE.TaskEither<Failure<T>, Success<T>> =>
    pipe(
      document,
      TE.of,
      TE.map(map),
      TE.chainW((decodedDoc) =>
        TE.tryCatch(
          () =>
            producer.sendMessage(
              Buffer.from(JSON.stringify(decodedDoc)).toString("base64")
            ),
          flow(E.toError, (error) => ({ document, error, success: false }))
        )
      ),
      TE.map(() => ({ document, success: true }))
    );

  return {
    publish: flow(
      sendOneMessage,
      TE.map((success) => success.document),
      TE.mapLeft((failure) => failure.error)
    ),
    publishes: flow(
      RA.map(sendOneMessage),
      TE.sequenceArray,
      TE.mapLeft((failure) => [failure]),
      TE.toUnion
    )
  };
};
