import { TableClient } from "@azure/data-tables";
import {
  RetrievedService,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { contramap } from "fp-ts/lib/Ord";
import * as T from "fp-ts/lib/Task";
import * as N from "fp-ts/number";
import * as RA from "fp-ts/ReadonlyArray";
import * as S from "fp-ts/string";
import { Validation } from "io-ts";

import * as AI from "../utils/AsyncIterableTask";
import {
  IBulkOperationResultEntity,
  toBulkOperationResultEntity
} from "../utils/bulkOperationResult";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { publish } from "../utils/publish";

export const importServices = (
  serviceModel: ServiceModel,
  client: KP.KafkaProducerCompact<RetrievedService>,
  errorStorage: TableClient
): Promise<IBulkOperationResultEntity> =>
  pipe(
    serviceModel.getCollectionIterator(),
    AI.fromAsyncIterable,
    AI.fold,
    T.map(RA.flatten),
    T.map(
      RA.sortBy([
        pipe(
          S.Ord,
          contramap((s: Validation<RetrievedService>) =>
            E.isRight(s) ? s.right.serviceId : ""
          )
        ),
        pipe(
          N.Ord,
          contramap((s: Validation<RetrievedService>) =>
            E.isRight(s) ? s.right.version : -1
          )
        )
      ])
    ),
    publish(client, errorStorage),
    T.map(toBulkOperationResultEntity("import-services"))
  )();
