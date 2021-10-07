import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as T from "fp-ts/lib/Task";
import * as RA from "fp-ts/ReadonlyArray";

import * as as from "azure-storage";

import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";

import { KafkaJSError } from "kafkajs";
import { KafkaProducerTopicConfig } from "../utils/kafka/KafkaTypes";
import * as KP from "../utils/kafka/kafkaProducer";

export const handleServicesChange = (
  client: KP.KafkaProducer,
  topic: KafkaProducerTopicConfig<RetrievedService>,
  storage: as.TableService,
  documents: ReadonlyArray<unknown>
): Promise<void> =>
  pipe(
    documents,
    RA.map(RetrievedService.decode),
    T.of,
    // publish entities on brokers and store errors
    T.chainFirst(
      flow(
        RA.rights,
        KP.sendMessages(topic, client),
        TE.toUnion,
        T.map(r => {
          console.log(`results: ${JSON.stringify(r)}`); // TODO: log errors into storage (Table API)
          return r;
        })
      )
    ),
    // store decode errors
    T.chainFirst(errors =>
      pipe(
        errors,
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
        T.of,
        T.map(r => {
          console.log(`decode errors: ${JSON.stringify(r)}`); // TODO: log errors into storage (Table API)
          return r;
        })
      )
    ),
    T.map(() => {})
  )();
