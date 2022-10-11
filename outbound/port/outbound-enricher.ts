import { Task } from "fp-ts/lib/Task";
import * as TE from "fp-ts/TaskEither";
import { Result } from "./outbound-publisher";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type OutboundEnricher<T> = {
  readonly enrich: (document: T) => TE.TaskEither<Error, T>;
  readonly enrichs: (
    documents: ReadonlyArray<T>
  ) => Task<ReadonlyArray<Result<T>>>;
};
