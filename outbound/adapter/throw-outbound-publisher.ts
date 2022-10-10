import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { OutboundPublisher, Result } from "../port/outbound-publisher";

export const create = <T>(): OutboundPublisher<T> => ({
  publish: (_document: T): TE.TaskEither<never, T> => {
    throw new Error("Error during document publication.");
  },
  publishes: (
    _documents: ReadonlyArray<T>
  ): T.Task<ReadonlyArray<Result<T>>> => {
    throw new Error("Error during documents publication.");
  }
});
