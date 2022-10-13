import { Task } from "fp-ts/lib/Task";
import * as TE from "fp-ts/TaskEither";
import { OutboundPublisher, Result } from "../port/outbound-publisher";

export const create = <T>(): OutboundPublisher<T> => ({
  publish: (_document: T): TE.TaskEither<never, T> => {
    throw new Error("Error during document publication.");
  },
  publishes: (_documents: ReadonlyArray<T>): Task<ReadonlyArray<Result<T>>> => {
    throw new Error("Error during documents publication.");
  }
});
