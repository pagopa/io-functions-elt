/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { Task } from "fp-ts/lib/Task";
import * as TE from "fp-ts/TaskEither";

export type Success<T> = { readonly document: T; readonly success: boolean };
export const success = <T>(document: T): Success<T> => ({
  document,
  success: true
});
export type Failure<T> = {
  readonly document: T;
  readonly error: Error;
  readonly success: boolean;
};
export const failure = <T>(error: Error, document: T): Failure<T> => ({
  document,
  error,
  success: false
});
export type Result<T> = Failure<T> | Success<T>;

export const isFailure = <T>(obj: Result<T>): obj is Failure<T> => !obj.success;
export const isSuccess = <T>(obj: Result<T>): obj is Success<T> => obj.success;

export type OutboundPublisher<T> = {
  readonly publish: (document: T) => TE.TaskEither<Error, T>;
  readonly publishes: (document: readonly T[]) => Task<readonly Result<T>[]>;
};
