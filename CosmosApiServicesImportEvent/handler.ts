import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import * as RA from "fp-ts/ReadonlyArray";

import {
  RetrievedService,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";

import { TableClient, TableInsertEntityHeaders } from "@azure/data-tables";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { IStorableSendFailureError } from "../utils/kafka/KafkaOperation";
import {
  IBulkOperationResult,
  toBulkOperationResult
} from "./bulkOperationResult";

const storeErrors = (errorStorage: TableClient) => (
  storableErrors: ReadonlyArray<IStorableSendFailureError<unknown>>
): ReadonlyArray<TE.TaskEither<Error, TableInsertEntityHeaders>> =>
  storableErrors.map(es =>
    TE.tryCatch(
      () =>
        errorStorage.createEntity({
          body: `${JSON.stringify(es.body)}`,
          message: es.message,
          name: es.name,
          partitionKey: `${new Date().getMonth() + 1}`,
          retriable: es.retriable,
          rowKey: `${Date.now()}`
        }),
      E.toError
    )
  );

export const importServices = (
  serviceModel: ServiceModel,
  client: KP.KafkaProducerCompact<RetrievedService>,
  errorStorage: TableClient
): Promise<IBulkOperationResult> =>
  pipe(
    serviceModel.listLastVersionServices(),
    TE.mapLeft(_ => toBulkOperationResult(false, `Decode Errors`)),
    TE.chain(
      TE.fromPredicate(O.isSome, _ =>
        toBulkOperationResult(false, `Empty service list`)
      )
    ),
    TE.map(option => option.value),
    // publish entities on brokers and store send errors
    TE.chain(
      flow(
        KP.sendMessages(client),
        TE.mapLeft(storeErrors(errorStorage)),
        TE.orLeft(RA.sequence(TE.ApplicativeSeq)),
        TE.mapLeft(_ =>
          toBulkOperationResult(
            false,
            `Error sending service list (Check error table for details)`
          )
        ),
        TE.map(_ => toBulkOperationResult(true, `Sent ${_.length} services`))
      )
    ),
    TE.toUnion
  )();
// export const importServices = (
//   serviceModel: ServiceModel,
//   client: KP.KafkaProducerCompact<RetrievedService>,
//   errorStorage: TableClient
// ): Promise<IBulkOperationResult> =>
//   pipe(
//     serviceModel.listLastVersionServices(),
//     TE.mapLeft(_ => toBulkOperationResult(false, `Decode Errors`)),
//     TE.chain(
//       TE.fromPredicate(O.isSome, _ =>
//         toBulkOperationResult(false, `Empty service list`)
//       )
//     ),
//     TE.map(option => option.value),
//     // publish entities on brokers and store send errors
//     TE.chain(
//       flow(
//         KP.sendMessages(client),
//         TE.mapLeft(storeErrors(errorStorage)),
//         TE.orLeft(RA.sequence(TE.ApplicativeSeq)),
//         TE.mapLeft(_ =>
//           toBulkOperationResult(
//             false,
//             `Error sending service list (Check error table for details)`
//           )
//         ),
//         TE.map(_ => toBulkOperationResult(true, `Sent ${_.length} services`))
//       )
//     ),
//     TE.toUnion
//   )();
