import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as E from "fp-ts/Either";
import * as RA from "fp-ts/ReadonlyArray";
import * as S from "fp-ts/string";
import * as N from "fp-ts/number";

import {
  RetrievedService,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";

import { TableClient } from "@azure/data-tables";
import { contramap } from "fp-ts/lib/Ord";
import { Validation } from "io-ts";
import * as AI from "../utils/AsyncIterableTask";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import {
  IBulkOperationResultEntity,
  toBulkOperationResultEntity
} from "../utils/bulkOperationResult";
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
    T.map(toBulkOperationResultEntity)
  )();
