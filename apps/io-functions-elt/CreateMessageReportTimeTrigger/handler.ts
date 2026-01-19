import { TableClient } from "@azure/data-tables";
import { AzureFunction, Context } from "@azure/functions";
import { IntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";

import { CommandMessageReport } from "../CosmosApiServicesImportEvent/commands";
import run from "../CosmosApiServicesImportEvent/index";
import * as AI from "../utils/AsyncIterableTask";

const TODO_STATUS = t.literal("TODO");
const ERROR_STATUS = t.literal("ERROR");
const DONE_STATUS = t.literal("DONE");
const PENDING_STATUS = t.literal("PENDING");

type AllStatus = t.TypeOf<typeof AllStatus>;
const AllStatus = t.union([
  TODO_STATUS,
  ERROR_STATUS,
  DONE_STATUS,
  PENDING_STATUS
]);

type Row = t.TypeOf<typeof Row>;
const Row = t.interface({
  partitionKey: t.string,

  rangeMax: IntegerFromString,
  rangeMin: IntegerFromString,
  rowKey: t.string,
  status: AllStatus
});

const logAndReturn =
  (context: Context) =>
  (...text: readonly unknown[]) =>
  <A>(a: A): A => {
    context.log(...text);
    return a;
  };

const startNewExport = (
  context: Context,
  table: TableClient,
  row: Row
): TE.TaskEither<Error, void> =>
  pipe(
    {
      operation: "process-message-report" as const,
      range_max: row.rangeMax,
      range_min: row.rangeMin
    },
    TE.of,
    TE.mapLeft(E.toError),
    TE.chainFirst(() =>
      TE.tryCatch(
        () =>
          table.updateEntity(
            Row.encode({
              ...row,
              status: PENDING_STATUS.value
            })
          ),
        E.toError
      )
    ),
    TE.map(logAndReturn(context)("Start export..")),
    TE.map(CommandMessageReport.encode),
    TE.chain((c) => TE.tryCatch(() => run(context, c), E.toError)),
    TE.map((_) => context.log("Export done...", _)),
    TE.mapLeft((_) =>
      logAndReturn(context)("An error occurred during export: ", _)(_)
    ),
    TE.mapLeft((error) =>
      pipe(
        TE.tryCatch(
          () =>
            table.updateEntity(
              Row.encode({
                ...row,
                status: ERROR_STATUS.value
              })
            ),
          E.toError
        ),
        TE.mapLeft((_) => {
          context.log(
            `Error updating row ${row.rowKey} status to 'ERROR': ${_}`
          );
          return error;
        }),
        // Just return the previous error
        () => error
      )
    ),
    TE.chainFirst(() =>
      TE.tryCatch(
        () =>
          table.updateEntity(
            Row.encode({
              ...row,
              status: DONE_STATUS.value
            })
          ),
        E.toError
      )
    )
  );

export const timerTrigger: (
  exportCommandsStorage: TableClient
) => AzureFunction =
  (exportCommandsStorage) =>
  async (context: Context): Promise<void> =>
    pipe(
      exportCommandsStorage.listEntities({
        queryOptions: {
          filter: `status ne '${DONE_STATUS.value}' and status ne '${ERROR_STATUS.value}'`
        }
      }),
      AI.fromAsyncIterable,
      AI.foldTaskEither(E.toError),
      TE.map(RA.map(Row.decode)),
      TE.map(RA.rights),
      TE.chain((records) =>
        records.length === 0
          ? // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
            TE.of<Error, void>(context.log("No report to perform.."))
          : records.find((r) => r.status === PENDING_STATUS.value) !== undefined
            ? // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
              TE.of<Error, void>(
                context.log("Another process pending, do nothing..")
              )
            : startNewExport(context, exportCommandsStorage, records[0])
      ),
      TE.mapLeft((_) => context.log("An error occurred: ", _)),

      TE.toUnion
    )();
