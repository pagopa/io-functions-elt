import { flow } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import { failure, OutboundPublisher } from "../port/outbound-publisher";

export const create = <T>(): OutboundPublisher<T> => ({
  publish: (_document: T): TE.TaskEither<Error, T> =>
    TE.left(new Error("Used an empty publisher")),
  publishes: flow(
    RA.map(document => failure(new Error("Used an empty publisher"), document)),
    T.of
  )
});
