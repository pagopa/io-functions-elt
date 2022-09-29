import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { QueueClient } from "@azure/storage-queue";
import { pipe } from "fp-ts/lib/function";
import { OutboundPublisher } from "../port/outbound-publisher";

export const create = <T>(producer: QueueClient): OutboundPublisher<T> => ({
  publish: (document: T): TE.TaskEither<Error, T> =>
    pipe(
      TE.tryCatch(
        () =>
          producer.sendMessage(
            Buffer.from(JSON.stringify(document)).toString("base64")
          ),
        E.toError
      ),
      TE.map(() => document)
    )
});
