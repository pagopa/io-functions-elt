import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as RA from "fp-ts/ReadonlyArray";

import { RetrievedMessageStatus } from "@pagopa/io-functions-commons/dist/src/models/message_status";
import { QueueClient } from "@azure/storage-queue";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { publishOrStore } from "../utils/publish";
import { IBulkOperationResult } from "../utils/bulkOperationResult";
import { TelemetryClient } from "../utils/appinsights";

export const handleMessageStatusChange = (
  documents: ReadonlyArray<unknown>,
  telemetryClient: TelemetryClient,
  producerClient: KP.KafkaProducerCompact<RetrievedMessageStatus>,
  queueClient: QueueClient
): Promise<IBulkOperationResult> =>
  pipe(
    documents,
    RA.map(RetrievedMessageStatus.decode),
    T.of,
    publishOrStore(producerClient, queueClient, telemetryClient, documents)
  )();
