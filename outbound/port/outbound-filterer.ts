// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type OutboundFilterer<T> = {
  readonly filterArray: (documents: ReadonlyArray<T>) => ReadonlyArray<T>;
};
