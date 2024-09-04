import * as crypto from "crypto";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { flow, pipe } from "fp-ts/lib/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { TelemetryClient } from "applicationinsights";
import { PdvTokenizerClient } from "./pdvTokenizerClient";

export interface PdvDependencies {
  readonly pdvTokenizerClient: PdvTokenizerClient;
  readonly appInsightsTelemetryClient: TelemetryClient;
}

export const getPdvId: (
  fiscalCode: FiscalCode
) => RTE.ReaderTaskEither<
  PdvDependencies,
  Error,
  NonEmptyString
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
> = fiscalCode => ({ pdvTokenizerClient }) =>
  pipe(
    TE.tryCatch(
      () => pdvTokenizerClient.saveUsingPUT({ body: { pii: fiscalCode } }),
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
        TE.mapLeft(errors => Error(readableReportSimplified(errors)))
      )
    )
  );
