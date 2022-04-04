export interface IStorableError<T> extends Error {
  readonly body: T;
}
