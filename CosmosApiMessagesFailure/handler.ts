import { flow, pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as RA from "fp-ts/ReadonlyArray";
import {
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { BlobService } from "azure-storage";
import { sequenceS } from "fp-ts/lib/Apply";
import * as E from "fp-ts/lib/Either";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { publishOrThrow } from "../utils/publish";
import { IBulkOperationResult } from "../utils/bulkOperationResult";
import { TelemetryClient } from "../utils/appinsights";
import {
  CHUNK_SIZE,
  enrichMessagesContent
} from "../CosmosApiMessagesChangeFeed/handler";

export const handle = (
  documents: ReadonlyArray<unknown>,
  telemetryClient: TelemetryClient,
  messageModel: MessageModel,
  blobService: BlobService,
  producerClient: KP.KafkaProducerCompact<RetrievedMessage>
  // eslint-disable-next-line max-params
): Promise<IBulkOperationResult> =>
  pipe(
    documents,
    RA.map(RetrievedMessage.decode),
    flow(retrievedMessages => ({
      lefts: T.of(retrievedMessages.filter(m => E.isLeft(m))),
      rights: pipe(
        retrievedMessages,
        RA.rights,
        enrichMessagesContent(messageModel, CHUNK_SIZE, blobService),
        T.map(RA.map(m => E.right(m)))
      )
    })),
    sequenceS(T.ApplyPar),
    T.map(({ lefts, rights }) => [...lefts, ...rights]),
    publishOrThrow(producerClient, telemetryClient, documents)
  )();
