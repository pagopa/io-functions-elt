import * as TE from "fp-ts/TaskEither";

export type OutboundPublisher<T> = {
  readonly publish: (document: T) => TE.TaskEither<Error, T>;
};
