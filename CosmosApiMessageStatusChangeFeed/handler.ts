import { TableClient } from "@azure/data-tables";
import { RetrievedMessageStatus } from "@pagopa/io-functions-commons/dist/src/models/message_status";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/lib/Task";
import { pipe } from "fp-ts/lib/function";

import { IBulkOperationResult } from "../utils/bulkOperationResult";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { publish } from "../utils/publish";

export const handleMessageStatusChange = (
  client: KP.KafkaProducerCompact<RetrievedMessageStatus>,
  errorStorage: TableClient,
  documents: ReadonlyArray<unknown>
): Promise<IBulkOperationResult> =>
  pipe(
    documents,
    RA.map(RetrievedMessageStatus.decode),
    T.of,
    publish(client, errorStorage, documents)
  )();
