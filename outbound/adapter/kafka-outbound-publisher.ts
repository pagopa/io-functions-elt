import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as O from "fp-ts/Option";
import { Task } from "fp-ts/lib/Task";
import { OutboundPublisher, Result } from "../port/outbound-publisher";
import { KafkaProducerCompact } from "../../utils/kafka/KafkaProducerCompact";
import * as KP from "../../utils/kafka/KafkaProducerCompact";

export const create = <T>(
  producer: KafkaProducerCompact<T>
): OutboundPublisher<T> => ({
  publish: (document: T): TE.TaskEither<Error, T> =>
    pipe(
      [document],
      KP.sendMessages(producer),
      TE.mapLeft(
        flow(
          RA.head,
          O.getOrElse(
            () =>
              new Error(
                "Kafka do not returned any result for the publish operation"
              )
          )
        )
      ),
      TE.map(() => document)
    ),

  publishes: (documents: ReadonlyArray<T>): Task<ReadonlyArray<Result<T>>> =>
    pipe(
      documents,
      KP.sendMessages(producer),
      TE.map(() =>
        pipe(
          documents,
          RA.map(document => ({ document, success: true }))
        )
      ),
      TE.mapLeft(
        RA.map(e => ({
          document: e.body,
          error: new Error(e.message),
          success: false
        }))
      ),
      TE.toUnion
    )
});
