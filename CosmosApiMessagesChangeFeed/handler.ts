import { BlobService } from "azure-storage";

import { flow, pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as RA from "fp-ts/ReadonlyArray";

import {
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { sequenceS } from "fp-ts/lib/Apply";
import { QueueClient } from "@azure/storage-queue";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { publishOrStore, storeErrors } from "../utils/publish";
import { IBulkOperationResult } from "../utils/bulkOperationResult";
import { IStorableError } from "../utils/types/storableErrors";
import { TelemetryClient } from "../utils/appinsights";

export const CHUNK_SIZE = 15;

/**
 * Retrieve a message content from blob storage and enrich message
 */
const enrichMessageContent = (
  messageModel: MessageModel,
  blobService: BlobService,
  message: RetrievedMessage
): TE.TaskEither<IStorableError<RetrievedMessage>, RetrievedMessage> =>
  pipe(
    messageModel.getContentFromBlob(blobService, message.id),
    TE.chain(TE.fromOption(() => Error(`Blob not found`))),
    TE.mapLeft(err => ({
      ...Error(`Message ${message.id}: ${err.message}`),
      body: message,
      retriable: true
    })),
    TE.map(content => ({
      ...message,
      content,
      kind: "IRetrievedMessageWithContent"
    }))
  );

/**
 * Enrich messages with content, retrieved from blob storage, if exists
 *
 */
export const enrichMessagesContent = (
  messageModel: MessageModel,
  mesageContentChunkSize: number,
  blobService: BlobService,
  errorQueueClient?: QueueClient
) => (
  messages: ReadonlyArray<RetrievedMessage>
): T.Task<ReadonlyArray<RetrievedMessage>> =>
  pipe(
    messages,
    // split execution in chunks of 'mesageContentChunkSize'
    RA.chunksOf(mesageContentChunkSize),
    RA.map(
      flow(
        RA.map(m =>
          m.isPending === false
            ? enrichMessageContent(messageModel, blobService, m)
            : TE.of(m)
        ),
        // call task in parallel
        RA.sequence(T.ApplicativePar)
      )
    ),
    // call chunk tasks sequentially
    RA.sequence(T.ApplicativeSeq),
    T.map(RA.flatten),
    T.map(mess => ({ errors: RA.lefts(mess), rights: RA.rights(mess) })),
    T.chain(({ errors, rights }) =>
      pipe(
        errors,
        es =>
          errorQueueClient ? storeErrors(errorQueueClient)(es) : TE.of({}),
        TE.toUnion,
        T.chain(() => T.of(rights))
      )
    )
  );

export const handle = (
  documents: ReadonlyArray<unknown>,
  telemetryClient: TelemetryClient,
  messageModel: MessageModel,
  blobService: BlobService,
  producerClient: KP.KafkaProducerCompact<RetrievedMessage>,
  queueClient: QueueClient
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
        enrichMessagesContent(
          messageModel,
          CHUNK_SIZE,
          blobService,
          queueClient
        ),
        T.map(RA.map(m => E.right(m)))
      )
    })),
    sequenceS(T.ApplyPar),
    T.map(({ lefts, rights }) => [...lefts, ...rights]),
    publishOrStore(producerClient, queueClient, telemetryClient, documents)
  )();
