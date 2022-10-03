import * as TE from "fp-ts/TaskEither";
import * as TT from "fp-ts/TaskThese";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type OutboundEnricher<T> = {
  readonly enrich: (document: T) => TE.TaskEither<Error, T>;
  readonly enrichs: (
    documents: ReadonlyArray<T>
  ) => TT.TaskThese<ReadonlyArray<T>, ReadonlyArray<T>>;
};
