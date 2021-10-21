import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as RA from "fp-ts/ReadonlyArray";

import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";

import { TableClient } from "@azure/data-tables";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { publish } from "../utils/publish";
import { IBulkOperationResult } from "../utils/bulkOperationResult";

export const handleServicesChange = (
  client: KP.KafkaProducerCompact<RetrievedService>,
  errorStorage: TableClient,
  documents: ReadonlyArray<unknown>
): Promise<IBulkOperationResult> =>
  pipe(
    documents,
    RA.map(RetrievedService.decode),
    T.of,
    publish(client, errorStorage, documents)
  )();
