export enum SeverityLevel {
  Critical = 4,
  Error = 3,
  Information = 1,
  Verbose = 0,
  Warning = 2
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type OutboundTracker = {
  readonly trackError: (error: Error, level?: SeverityLevel) => void;
};
