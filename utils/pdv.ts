import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { flow, pipe } from "fp-ts/lib/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { TelemetryClient } from "applicationinsights";
import { RedisClientType } from "redis";
import { PdvTokenizerClient } from "./pdvTokenizerClient";
import { sha256 } from "./crypto";
import {
  falsyResponseToErrorAsync,
  PDVIdPrefix,
  singleStringReply
} from "./redis";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type PdvDependencies = {
  readonly pdvTokenizerClient: PdvTokenizerClient;
  readonly redisClientTask: TE.TaskEither<Error, RedisClientType>;
  readonly appInsightsTelemetryClient: TelemetryClient;
};

const obtainTokenFromPDV: (
  fiscalCode: FiscalCode,
  redisClient: RedisClientType,
  pdvTokenizerClient: PdvTokenizerClient
) => TE.TaskEither<Error, NonEmptyString> = (
  fiscalCode,
  redisClient,
  pdvTokenizerClient
) =>
  pipe(
    TE.tryCatch(
      () =>
        pdvTokenizerClient.saveUsingPUT({
          body: { pii: fiscalCode }
        }),
      E.toError
    ),
    TE.chainEitherKW(
      E.mapLeft(errors => Error(readableReportSimplified(errors)))
    ),
    TE.chain(pdvResponse =>
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
        TE.mapLeft(errors =>
          Error(
            `Unexpected empty token from tokenizer: ${readableReportSimplified(
              errors
            )}`
          )
        )
      )
    ),
    // Save obtained token for further usage
    TE.chainFirst(pdvId =>
      pipe(
        TE.tryCatch(
          () => redisClient.set(`${PDVIdPrefix}${fiscalCode}`, pdvId),
          E.toError
        ),
        singleStringReply,
        falsyResponseToErrorAsync(Error("Error saving the key"))
      )
    )
  );

export const getPdvId: (
  fiscalCode: FiscalCode
) => RTE.ReaderTaskEither<
  PdvDependencies,
  Error,
  NonEmptyString
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
> = fiscalCode => ({
  pdvTokenizerClient,
  appInsightsTelemetryClient,
  redisClientTask
}) =>
  pipe(
    redisClientTask,
    TE.chain(redisClient =>
      pipe(
        // check if redis cache already holds the info
        TE.tryCatch(
          () => redisClient.get(`${PDVIdPrefix}${fiscalCode}`),
          E.toError
        ),
        TE.chain(
          flow(
            NonEmptyString.decode,
            TE.fromEither,
            // Calling PDV to obtain a token if nothing was found in the cache
            TE.orElse(() =>
              obtainTokenFromPDV(fiscalCode, redisClient, pdvTokenizerClient)
            )
          )
        )
      )
    ),
    TE.mapLeft(error => {
      // unexpected behaviour that needs tracking
      appInsightsTelemetryClient.trackEvent({
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
