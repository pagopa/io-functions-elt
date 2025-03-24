import { TableClient, TableInsertEntityHeaders } from "@azure/data-tables";
import {
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { BlobService } from "azure-storage";
import * as RA from "fp-ts/ReadonlyArray";
import { sequenceS } from "fp-ts/lib/Apply";
import * as E from "fp-ts/lib/Either";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";

import { IBulkOperationResult } from "../utils/bulkOperationResult";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { publish } from "../utils/publish";
import { IStorableError } from "../utils/types/storableErrors";

const CHUNK_SIZE = 15;

/**
 * Store errors in errorStorage table
 *
 * @param errorStorage
 * @returns
 */
const storeMessageErrors =
  (errorStorage: TableClient) =>
  (
    storableErrors: ReadonlyArray<IStorableError<RetrievedMessage>>
  ): ReadonlyArray<TE.TaskEither<Error, TableInsertEntityHeaders>> =>
    storableErrors.map((es) =>
      TE.tryCatch(
        () =>
          errorStorage.createEntity({
            body: `${JSON.stringify(es.body)}`,
            message: es.message,
            name: "Message Error",
            partitionKey: `${new Date().getMonth() + 1}`,
            rowKey: `${Date.now()}`
          }),
        E.toError
      )
    );

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
    TE.mapLeft((err) => ({
      ...Error(`Message ${message.id}: ${err.message}`),
      body: message
    })),
    TE.map((content) => ({
      ...message,
      content,
      kind: "IRetrievedMessageWithContent"
    }))
  );

/**
 * Enrich messages with content, retrieved from blob storage, if exists
 *
 */
export const enrichMessagesContent =
  (
    messageModel: MessageModel,
    mesageContentChunkSize: number,
    blobService: BlobService,
    errorStorage: TableClient
  ) =>
  (
    messages: ReadonlyArray<RetrievedMessage>
  ): T.Task<ReadonlyArray<RetrievedMessage>> =>
    pipe(
      messages,
      // split execution in chunks of 'mesageContentChunkSize'
      RA.chunksOf(mesageContentChunkSize),
      RA.map(
        flow(
          RA.map((m) =>
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
      T.map((mess) => ({ errors: RA.lefts(mess), rights: RA.rights(mess) })),
      TE.fromTask,
      TE.chain(({ errors, rights }) =>
        pipe(
          errors,
          storeMessageErrors(errorStorage),
          RA.sequence(TE.ApplicativeSeq),
          TE.bimap(
            (err) => {
              throw err;
            },
            () => rights
          )
        )
      ),
      TE.toUnion
    );

export const handleMessageChange =
  (messageModel: MessageModel, blobService: BlobService) =>
  (
    client: KP.KafkaProducerCompact<RetrievedMessage>,
    errorStorage: TableClient,
    documents: ReadonlyArray<unknown>
  ): Promise<IBulkOperationResult> =>
    pipe(
      documents,
      RA.map(RetrievedMessage.decode),
      flow((retrievedMessages) => ({
        lefts: T.of(retrievedMessages.filter((m) => E.isLeft(m))),
        rights: pipe(
          retrievedMessages,
          RA.rights,
          enrichMessagesContent(
            messageModel,
            CHUNK_SIZE,
            blobService,
            errorStorage
          ),
          T.map(RA.map((m) => E.right(m)))
        )
      })),
      sequenceS(T.ApplyPar),
      T.map(({ lefts, rights }) => [...lefts, ...rights]),
      publish(client, errorStorage, documents)
    )();
