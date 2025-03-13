import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";
import { TelemetryClient } from "applicationinsights";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";
import { RedisClientType } from "redis";

import { sha256 } from "./crypto";
import { PdvTokenizerClient } from "./pdvTokenizerClient";
import {
  PDVIdPrefix,
  sendSampledRedisCommandError,
  sendSampledRedisNetworkError
} from "./redis";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type PdvDependencies = {
  readonly pdvTokenizerClient: PdvTokenizerClient;
  readonly redisClientTask: TE.TaskEither<Error, RedisClientType>;
  readonly PDVIdKeyTTLinSeconds: Second;
  readonly appInsightsTelemetryClient: TelemetryClient;
};

const obtainTokenFromPDV: (fiscalCode: FiscalCode) => RTE.ReaderTaskEither<
  PdvDependencies,
  Error,
  NonEmptyString
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
> = (fiscalCode) => (deps) =>
  pipe(
    TE.tryCatch(
      () =>
        deps.pdvTokenizerClient.saveUsingPUT({
          body: { pii: fiscalCode }
        }),
      E.toError
    ),
    TE.chainEitherKW(
      E.mapLeft((errors) => Error(readableReportSimplified(errors)))
    ),
    TE.chain((pdvResponse) =>
      pdvResponse.status === 200
        ? TE.right<Error, string>(pdvResponse.value.token)
        : TE.left(
            Error(
              `Pdv tokenizer returned ${pdvResponse.status} with error: ${pdvResponse.value?.title}`
            )
          )
    ),
    TE.chain(
      flow(
        NonEmptyString.decode,
        TE.fromEither,
        TE.mapLeft((errors) =>
          Error(
            `Unexpected empty token from tokenizer: ${readableReportSimplified(
              errors
            )}`
          )
        )
      )
    ),
    // Save obtained token for further usage (fire and forget)
    TE.chainFirstW((pdvId) =>
      pipe(
        deps.redisClientTask,
        sendSampledRedisNetworkError(deps.appInsightsTelemetryClient),
        TE.chain((redisClient) =>
          pipe(
            TE.tryCatch(
              () =>
                redisClient.setEx(
                  `${PDVIdPrefix}${fiscalCode}`,
                  deps.PDVIdKeyTTLinSeconds,
                  pdvId
                ),
              E.toError
            ),
            sendSampledRedisCommandError(deps.appInsightsTelemetryClient)
          )
        ),
        TE.map(() => void 0),
        TE.orElse(() => TE.of(void 0))
      )
    )
  );

export const getPdvId: (fiscalCode: FiscalCode) => RTE.ReaderTaskEither<
  PdvDependencies,
  Error,
  NonEmptyString
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
> = (fiscalCode) => (deps) =>
  pipe(
    deps.redisClientTask,
    TE.chain((redisClient) =>
      pipe(
        // check if redis cache already holds the info
        TE.tryCatch(
          () => redisClient.get(`${PDVIdPrefix}${fiscalCode}`),
          E.toError
        ),
        sendSampledRedisCommandError(deps.appInsightsTelemetryClient),
        TE.chainEitherKW(NonEmptyString.decode)
      )
    ),
    // Calling PDV to obtain a token if nothing was found in the cache
    TE.orElse(() => obtainTokenFromPDV(fiscalCode)(deps)),
    TE.mapLeft((error) => {
      // unexpected behaviour that needs tracking
      deps.appInsightsTelemetryClient.trackEvent({
        name: "fn-elt.getPdvId.error",
        properties: {
          error_message: error.message,
          fiscal_code: sha256(fiscalCode)
        },
        tagOverrides: { samplingEnabled: "false" }
      });
      return error;
    })
  );
