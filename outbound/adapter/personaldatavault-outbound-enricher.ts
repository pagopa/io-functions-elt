import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { OutboundEnricher } from "../port/outbound-enricher";
import { failure, success } from "../port/outbound-publisher";
import { HasFiscalCodeAndToken } from "../../utils/types/identificable";
import { APIClient } from "../../clients/personalDataValult";

export const DEFAULT_THROTTLING = 5;

const ERROR_PREFIX = "Error saving CF on Personal Data Vault";

export const create = <I extends HasFiscalCodeAndToken>(
  personalDataVaultClient: APIClient,
  maxParallelThrottling: number = DEFAULT_THROTTLING
): OutboundEnricher<I> => {
  const enrichWithToken = (item: I): TE.TaskEither<Error, I> =>
    pipe(
      TE.tryCatch(
        () =>
          personalDataVaultClient.saveUsingPUT({
            body: { pii: item.fiscalCode }
          }),
        flow(
          E.toError,
          original =>
            new Error(`${ERROR_PREFIX} (http failure). ${original.message}`)
        )
      ),
      TE.chain(
        flow(
          E.mapLeft(readableReportSimplified),
          E.mapLeft(
            errorReport =>
              new Error(`${ERROR_PREFIX} (malformed response). ${errorReport}`)
          ),
          TE.fromEither
        )
      ),
      TE.chainW(res =>
        res.status === 200
          ? TE.right(res.value.token)
          : TE.left(
              new Error(
                `${ERROR_PREFIX} (${res.status}). ${res.value?.title}: ${res.value?.detail}`
              )
            )
      ),
      TE.map(token => ({ ...item, token }))
    );

  return {
    enrich: enrichWithToken,
    enrichs: flow(
      RA.chunksOf(maxParallelThrottling),
      RA.map(
        flow(
          RA.map(message =>
            pipe(
              enrichWithToken(message),
              TE.map(success),
              TE.mapLeft(error => failure(error, message))
            )
          ),
          RA.sequence(T.ApplicativePar)
        )
      ),
      RA.sequence(T.ApplicativeSeq),
      T.map(RA.flatten),
      T.map(RA.map(E.toUnion))
    )
  };
};
