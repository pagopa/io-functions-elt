import * as TE from "fp-ts/TaskEither";
import { OutboundPublisher } from "../port/outbound-publisher";

export const create = <T>(): OutboundPublisher<T> => ({
  publish: (_document: T): TE.TaskEither<never, T> => {
    throw new Error("Error during document publication.");
  }
});
