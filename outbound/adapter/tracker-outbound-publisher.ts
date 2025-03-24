import { initAppInsights } from "@pagopa/ts-commons/lib/appinsights";
import { IntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as ai from "applicationinsights";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";

import { OutboundTracker, SeverityLevel } from "../port/outbound-tracker";

const DEFAULT_SAMPLING_PERCENTAGE = 5;

/* MOVE me to ts-commons or fn-commons */
export type TelemetryClient = ai.TelemetryClient;
export const initTelemetryClient = (
  intrumentationKey: NonEmptyString,
  env = process.env
): TelemetryClient =>
  ai.defaultClient
    ? ai.defaultClient
    : initAppInsights(intrumentationKey, {
        disableAppInsights: env.APPINSIGHTS_DISABLE === "true",
        samplingPercentage: pipe(
          IntegerFromString.decode(env.APPINSIGHTS_SAMPLING_PERCENTAGE),
          E.getOrElse(() => DEFAULT_SAMPLING_PERCENTAGE)
        )
      });
/**/

export const create = (aiClient: TelemetryClient): OutboundTracker => ({
  trackError: (
    error: Error,
    level: SeverityLevel = SeverityLevel.Error
  ): void => {
    pipe(
      aiClient,
      O.fromNullable,
      O.map((client) =>
        O.tryCatch(() =>
          client.trackException({ exception: error, severity: level })
        )
      )
    );
  }
});
