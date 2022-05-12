export interface IStorableError<T> extends Error {
  readonly body: T;
  readonly retriable: boolean;
}
