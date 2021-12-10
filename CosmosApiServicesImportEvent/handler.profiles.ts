import { Context } from "@azure/functions";
import { BlobService } from "azure-storage";

import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/Either";

import * as t from "io-ts";

import {
  ProfileModel,
  RetrievedProfile
} from "@pagopa/io-functions-commons/dist/src/models/profile";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as AI from "../utils/AsyncIterableTask";
import {
  IBulkOperationResultEntity,
  toBulkOperationResultEntity
} from "../utils/bulkOperationResult";

/**
 * Build a Cosmos query iterator for messages with a min and max timestamp.
 */
export const buildIterator = (
  profileModel: ProfileModel,
  cosmosChunkSize: number,
  cosmosDegreeeOfParallelism: number
) => (): AsyncIterable<ReadonlyArray<t.Validation<RetrievedProfile>>> =>
  profileModel.getQueryIterator(
    {
      query: `SELECT * FROM p WHERE p._ts <= 1638316799`
    },
    {
      maxDegreeOfParallelism: cosmosDegreeeOfParallelism,
      maxItemCount: cosmosChunkSize
    }
  );

// ------------------
// Process report
// ------------------

/**
 * Process all messages between min and max timestamp values
 * and write a csv into blob storage
 */
export const processProfiles = (
  messageModel: ProfileModel,
  exportToBlob: (
    blobName: string
  ) => (text: string) => TE.TaskEither<Error, BlobService.BlobResult>,
  cosmosChunkSize: number,
  cosmosDegreeeOfParallelism: number
  // eslint-disable-next-line max-params
) => async (context: Context): Promise<IBulkOperationResultEntity> =>
  pipe(
    buildIterator(messageModel, cosmosChunkSize, cosmosDegreeeOfParallelism)(),
    AI.fromAsyncIterable,
    T.map(_ => {
      context.log(`[Profiles][${Date.now()}] Start retrieving data..`);
      return _;
    }),
    AI.map(page => {
      const [rights, lefts] = [RA.rights(page), RA.lefts(page)];
      if (lefts.length > 0) {
        context.log(
          `[Profiles] ERROR: ${lefts.length} messages metadata not loaded`
        );
      }
      return rights;
    }),
    AI.foldTaskEither(E.toError),
    TE.map(
      RA.reduce(new Set<FiscalCode>(), (set, curr) => {
        for (const profile of curr) {
          set.add(profile.fiscalCode);
        }
        return set;
      })
    ),
    T.map(_ => {
      context.log(`[Profiles] [${Date.now()}] End retrieving data..`);
      return _;
    }),
    TE.map(set => Array.from(set.values())),
    TE.map(set => JSON.stringify(set)),
    TE.chain(_ => {
      context.log("[Profiles] Writing..");
      return exportToBlob(`fiscalCodes.json`)(_);
    }),
    T.map(_ => {
      context.log(`[Profiles] Result success:  ${E.isRight(_)}`);
      return _;
    }),
    TE.map(_ => ({ isSuccess: true, result: "none" })),
    TE.mapLeft(_ => ({ isSuccess: false, result: "none" })),
    TE.toUnion,
    T.map(toBulkOperationResultEntity("process-profile-report"))
  )();
