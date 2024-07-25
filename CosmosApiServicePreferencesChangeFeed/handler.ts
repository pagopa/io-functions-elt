import { TableClient } from "@azure/data-tables";

import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as RA from "fp-ts/ReadonlyArray";

import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { publish } from "../utils/publish";
import { IBulkOperationResult } from "../utils/bulkOperationResult";

export const handleServicePreferencesChange = (
  client: KP.KafkaProducerCompact<RetrievedServicePreference>,
  errorStorage: TableClient,
  documents: ReadonlyArray<unknown>
): Promise<IBulkOperationResult> =>
  pipe(
    documents,
    RA.map(RetrievedServicePreference.decode),
    T.of,
    publish(client, errorStorage, documents)
  )();
