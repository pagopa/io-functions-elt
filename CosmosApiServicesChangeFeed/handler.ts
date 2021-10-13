import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as T from "fp-ts/lib/Task";
import * as RA from "fp-ts/ReadonlyArray";

import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";

import { KafkaJSError } from "kafkajs";
import { TableClient, TableInsertEntityHeaders } from "@azure/data-tables";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { IStorableSendFailureError } from "../utils/kafka/KafkaOperation";

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
          partitionKey: `${new Date().getMonth}`,
          retriable: es.retriable,
          rowKey: `${Date.now()}`
        }),
      E.toError
    )
  );

export const handleServicesChange = (
  client: KP.KafkaProducerCompact<RetrievedService>,
  errorStorage: TableClient,
  documents: ReadonlyArray<unknown>
): Promise<void> =>
  pipe(
    documents,
    RA.map(RetrievedService.decode),
    T.of,
    // publish entities on brokers and store send errors
    T.chainFirst(
      flow(
        RA.rights,
        KP.sendMessages(client),
        TE.mapLeft(storeErrors(errorStorage)),
        TE.orLeft(RA.sequence(TE.ApplicativeSeq)),
        TE.toUnion
      )
    ),
    // store decode errors
    T.chainFirst(
      flow(
        RA.mapWithIndex((i, decodeResult) =>
          pipe(
            decodeResult,
            E.mapLeft(errorsToReadableMessages),
            E.mapLeft(
              RA.reduce("", (errorsJoined, rde) => errorsJoined + " | " + rde)
            ),
            E.mapLeft(errorsJoined => ({
              ...new KafkaJSError(errorsJoined, { retriable: false }),
              body: documents[i]
            }))
          )
        ),
        RA.lefts,
        storeErrors(errorStorage),
        RA.sequence(TE.ApplicativeSeq),
        TE.toUnion
      )
    ),
    T.map(() => {})
  )();
