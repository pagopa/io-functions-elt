import { EventTelemetry } from "applicationinsights/out/Declarations/Contracts";

export enum SeverityLevel {
  Verbose = 0,
  Information = 1,
  Warning = 2,
  Error = 3,
  Critical = 4
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type OutboundTracker = {
  readonly trackError: (error: Error, level?: SeverityLevel) => void;
  readonly trackEvent: (evtTelemetry: EventTelemetry) => void;
};
