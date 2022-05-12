import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as RA from "fp-ts/ReadonlyArray";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { IBulkOperationResult } from "../utils/bulkOperationResult";
import { TelemetryClient } from "../utils/appinsights";
import { publishOrThrow } from "../utils/publish";

export const handle = (
  documents: ReadonlyArray<unknown>,
  telemetryClient: TelemetryClient,
  producerClient: KP.KafkaProducerCompact<RetrievedService>
): Promise<IBulkOperationResult> =>
  pipe(
    documents,
    RA.map(RetrievedService.decode),
    T.of,
    publishOrThrow(producerClient, telemetryClient, documents)
  )();
