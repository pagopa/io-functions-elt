export interface IStorableError<T> {
  readonly error: Error;
  readonly body: T;
  readonly retriable: boolean;
}
