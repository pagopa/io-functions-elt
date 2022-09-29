import * as TE from "fp-ts/TaskEither";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type OutboundPublisher<T> = {
  readonly publish: (document: T) => TE.TaskEither<Error, T>;
};
