import {
  BulkOperationType,
  Container,
  OperationResponse,
  PatchOperationType,
  RequestOptions
} from "@azure/cosmos";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as TE from "fp-ts/TaskEither";
import {
  CosmosErrorResponse,
  CosmosErrors,
  toCosmosErrorResponse
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { flow, pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as AR from "fp-ts/Array";
import { FiscalCode } from "@pagopa/io-functions-commons/dist/generated/definitions/FiscalCode";
import { RetrievedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/src/models/message";
import * as T from "fp-ts/lib/Task";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";

const VERSION_PADDING_LENGTH = 16;
const getVersionedIds = (
  messageId: string,
  versionStart: number = 0,
  maxBulk: number = 25 // Cosmos SDK limit = 100
): ReadonlyArray<NonEmptyString> =>
  RA.makeBy(
    maxBulk,
    i =>
      `${messageId}-${(
        "0".repeat(VERSION_PADDING_LENGTH) + String(versionStart + i)
      ).slice(-VERSION_PADDING_LENGTH)}` as NonEmptyString
  );

export const patchAllVersion: (
  container: Container,
  options?: RequestOptions
) => (message: {
  readonly fiscalCode: FiscalCode;
  readonly id: NonEmptyString;
}) => TE.TaskEither<CosmosErrors, ReadonlyArray<OperationResponse>> = (
  container,
  options
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => ({ fiscalCode, id }) =>
  pipe(
    getVersionedIds(id, 0),
    RA.map(messageStatusId => ({
      id: messageStatusId,
      operationType: BulkOperationType.Patch,
      partitionKey: id,
      resourceBody: {
        operations: [
          {
            op: PatchOperationType.add,
            path: `/fiscalCode`,
            value: fiscalCode
          }
        ]
      }
    })),
    readonlyPatchOperations => readonlyPatchOperations.slice(), // copy the readonly array to a mutable one
    patchOperations =>
      TE.tryCatch(
        () =>
          container.items.bulk(
            patchOperations,
            { continueOnError: false },
            options
          ),
        toCosmosErrorResponse
      ),
    TE.filterOrElse(
      results =>
        pipe(
          results,
          AR.reduce(
            true as boolean,
            (hasError, response) =>
              hasError && [200, 404, 424].includes(response.statusCode)
          )
        ),
      results =>
        CosmosErrorResponse({
          message: `Error patching document [${results.reduce(
            (p, c, i, _a) => `${p}${i > 0 ? "," : ""}${c.statusCode}`,
            ""
          )}]`,
          name: `Patching Error`
        })
    )
  );

export const handle = (
  container: Container,
  rawMessages: ReadonlyArray<unknown>
): Promise<ReadonlyArray<number>> =>
  pipe(
    rawMessages,
    RA.map(
      flow(
        RetrievedMessageWithoutContent.decode,
        TE.fromEither,
        TE.mapLeft(readableReport),
        TE.mapLeft(msg => new Error(msg)),
        TE.chainW(patchAllVersion(container)),
        TE.map(responses =>
          pipe(
            responses,
            RA.reduce(404, (previous, result) =>
              result.statusCode !== 200 ? previous : result.statusCode
            )
          )
        ),
        TE.mapLeft(e => {
          throw e;
        }),
        TE.toUnion
      )
    ),
    RA.sequence(T.ApplicativePar)
  )();

export default handle;
