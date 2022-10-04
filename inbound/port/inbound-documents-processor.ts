import * as T from "fp-ts/Task";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type InboundDocumentsProcessor = {
  readonly process: (documents: ReadonlyArray<unknown>) => T.Task<void>;
};
