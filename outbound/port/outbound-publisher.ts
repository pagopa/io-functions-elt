/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { Task } from "fp-ts/lib/Task";
import * as TE from "fp-ts/TaskEither";

export type Success<T> = { readonly success: boolean; readonly document: T };
export type Failure<T> = {
  readonly success: boolean;
  readonly document: T;
  readonly error: Error;
};
export type Result<T> = Success<T> | Failure<T>;

export const isFailure = <T>(obj: Result<T>): obj is Failure<T> => !obj.success;

export type OutboundPublisher<T> = {
  readonly publish: (document: T) => TE.TaskEither<Error, T>;
  readonly publishes: (
    document: ReadonlyArray<T>
  ) => Task<ReadonlyArray<Result<T>>>;
};
