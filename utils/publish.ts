import { identity, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import * as E from "fp-ts/lib/Either";
import * as RA from "fp-ts/ReadonlyArray";
import { Validation } from "io-ts";

import { TableClient, TableInsertEntityHeaders } from "@azure/data-tables";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { toString } from "lodash";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { IStorableSendFailureError } from "./kafka/KafkaOperation";
import { IBulkOperationResult } from "./bulkOperationResult";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const kerr = require("kafkajs/src/errors.js"); // due to suspected issue "KafkaJsError is not a costructor" whe using kafkajs type

const storeErrors = (errorStorage: TableClient) => (
  storableErrors: ReadonlyArray<IStorableSendFailureError<unknown>>
): ReadonlyArray<TE.TaskEither<Error, TableInsertEntityHeaders>> =>
  storableErrors.map(es =>
    TE.tryCatch(
      () =>
        errorStorage.createEntity({
          body: `${JSON.stringify(es.body)}`,
          message: es.message,
          name: es.name,
          partitionKey: `${new Date().getMonth() + 1}`,
          retriable: es.retriable,
          rowKey: `${Date.now()}`
        }),
      E.toError
    )
  );

export const publish = <T>(
  client: KP.KafkaProducerCompact<T>,
  errorStorage: TableClient,
  documents?: ReadonlyArray<unknown>
) => (
  task: T.Task<ReadonlyArray<Validation<T>>>
): T.Task<IBulkOperationResult> =>
  pipe(
    task,
    T.bindTo("input"),
    // publish entities on brokers and store send errors
    T.bind("sendResult", ({ input }) =>
      pipe(
        input,
        RA.rights,
        KP.sendMessages(client),
        TE.mapLeft(storeErrors(errorStorage)),
        TE.orElseFirstW(RA.sequence(TE.ApplicativeSeq)),
        TE.map(messagesSent => `Documents sent (${messagesSent.length}).`),
        TE.mapLeft(
          __ =>
            "Error publishing some documents. Check storage table errors for details."
        )
      )
    ),
    // store decode errors
    T.bind("decodeResult", ({ input }) =>
      pipe(
        input,
        RA.mapWithIndex((i, decodeResult) =>
          pipe(
            decodeResult,
            E.mapLeft(errorsToReadableMessages),
            E.mapLeft(
              RA.reduce("", (errorsJoined, rde) => errorsJoined + " | " + rde)
            ),
            E.mapLeft(errorsJoined => ({
              ...new kerr.KafkaJSError(errorsJoined, { retriable: false }),
              body: documents ? documents[i] : ""
            }))
          )
        ),
        RA.lefts,
        TE.fromPredicate(lefts => lefts.length === 0, identity),
        TE.map(_ => undefined),
        TE.mapLeft(storeErrors(errorStorage)),
        TE.orElseW(RA.sequence(TE.ApplicativeSeq)),
        TE.mapLeft(e => toString(e)),
        TE.chain(res =>
          typeof res === "undefined"
            ? TE.of("No decoding errors.")
            : TE.left(
                "Error decoding some documents. Check storage table errors for details."
              )
        )
      )
    ),
    T.map(({ sendResult, decodeResult }) => ({
      isSuccess: E.isRight(sendResult) && E.isRight(decodeResult),
      result: `${E.toUnion(sendResult)} ${E.toUnion(decodeResult)}`
    }))
  );
