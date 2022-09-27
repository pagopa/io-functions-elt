export declare enum SeverityLevel {
  Verbose = 0,
  Information = 1,
  Warning = 2,
  Error = 3,
  Critical = 4
}

export type OutboundTracker = {
  readonly trackError: (error: Error, level?: SeverityLevel) => void;
};
