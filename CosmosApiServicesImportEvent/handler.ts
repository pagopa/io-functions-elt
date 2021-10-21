import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as RA from "fp-ts/ReadonlyArray";

import {
  RetrievedService,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";

import { TableClient } from "@azure/data-tables";
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
    publish(client, errorStorage),
    T.map(toBulkOperationResultEntity)
  )();
