import { Context } from "@azure/functions";
import { BlobService } from "azure-storage";

import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import * as O from "fp-ts/Option";
import * as M from "fp-ts/Map";
import * as S from "fp-ts/string";
import * as E from "fp-ts/Either";

import * as t from "io-ts";

import {
  Message,
  MessageModel,
  RetrievedMessage,
  RetrievedMessageWithContent,
  RetrievedMessageWithoutContent
} from "@pagopa/io-functions-commons/dist/src/models/message";

import { PaymentData } from "@pagopa/io-functions-commons/dist/generated/definitions/PaymentData";
import { upsertBlobFromText } from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";

import * as AI from "../utils/AsyncIterableTask";
import {
  IBulkOperationResultEntity,
  toBulkOperationResultEntity
} from "../utils/bulkOperationResult";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type MessageInfo = {
  readonly messages_total: number;
  readonly messages_sent: number;
  readonly payment_messages: number;
};

const PaymentMessage = t.interface({
  content: t.interface({ payment_data: PaymentData })
});
const RetrievedNotPendingMessage = t.intersection([
  RetrievedMessageWithoutContent,
  t.interface({ isPending: t.literal(false) })
]);

/**
 * Build a Cosmos query iterator for messages with a min and max timestamp.
 */
export const buildIterator = (
  messageModel: MessageModel,
  cosmosChunkSize: number,
  cosmosDegreeeOfParallelism: number
) => (
  rangeMin: number,
  rangeMax: number
): AsyncIterable<ReadonlyArray<t.Validation<RetrievedMessage>>> =>
  messageModel.getQueryIterator(
    {
      parameters: [
        {
          name: "@min",
          value: rangeMin
        },
        {
          name: "@max",
          value: rangeMax
        }
      ],
      query: `SELECT * FROM m WHERE m._ts > @min AND m._ts <= @max`
    },
    {
      maxDegreeOfParallelism: cosmosDegreeeOfParallelism,
      maxItemCount: cosmosChunkSize
    }
  );

/**
 * Retrieve a message content from blob storage and enrich message
 */
export const enrichMessageContent = (
  messageModel: MessageModel,
  blobService: BlobService,
  message: RetrievedMessage
): T.Task<RetrievedMessageWithContent | RetrievedMessage> =>
  pipe(
    messageModel.getContentFromBlob(blobService, message.id),
    TE.chain(
      O.fold(
        () => TE.left(Error("blob not found")),
        _ => TE.right(_)
      )
    ),
    TE.map(content => ({ ...message, content })),
    TE.orElseW(_e => TE.right(message)),
    TE.toUnion
  );

/**
 * Enrich messages with content, retrieved from blob storage, if exists
 *
 */
const enrichMessagesContent = (
  messageModel: MessageModel,
  mesageContentChunkSize: number,
  blobService: BlobService,
  messages: ReadonlyArray<RetrievedMessage>
): T.Task<ReadonlyArray<RetrievedMessageWithContent | RetrievedMessage>> =>
  pipe(
    messages,
    RA.chunksOf(mesageContentChunkSize),
    RA.map(chunks =>
      pipe(
        chunks,
        RA.map(m =>
          !m.isPending
            ? enrichMessageContent(messageModel, blobService, m)
            : T.of(m)
        ),
        RA.sequence(T.ApplicativePar)
      )
    ),
    RA.sequence(T.ApplicativeSeq),
    T.map(RA.flatten)
  );

/**
 * return an updated MessageInfo, based on `message` values
 */
const updateMessageInfo = (
  curr: MessageInfo | undefined,
  message: Message
): MessageInfo =>
  pipe(
    curr,
    value =>
      value ?? { messages_sent: 0, messages_total: 0, payment_messages: 0 },
    value => ({
      messages_total: value.messages_total + 1,
      // eslint-disable-next-line sort-keys
      messages_sent:
        value.messages_sent + (RetrievedNotPendingMessage.is(message) ? 1 : 0),
      payment_messages:
        value.payment_messages + (PaymentMessage.is(message) ? 1 : 0)
    })
  );

/**
 * Process all messages between min and max timestamp values
 * and write a csv into blob storage
 */
export const processMessages = (
  messageModel: MessageModel,
  blobService: BlobService,
  csvFilesBlobService: BlobService,
  cosmosDegreeeOfParallelism: number,
  cosmosChunkSize: number,
  mesageContentChunkSize: number
  // eslint-disable-next-line max-params
) => async (
  context: Context,
  rangeMin: number,
  rangeMax: number
): Promise<IBulkOperationResultEntity> =>
  pipe(
    buildIterator(
      messageModel,
      cosmosChunkSize,
      cosmosDegreeeOfParallelism
    )(rangeMin, rangeMax),
    AI.fromAsyncIterable,
    AI.map(RA.rights),
    AI.map(messages =>
      enrichMessagesContent(
        messageModel,
        mesageContentChunkSize,
        blobService,
        messages
      )()
    ),
    T.map(_ => {
      context.log(`Start retrieving data.. ${Date.now()}`);
      return _;
    }),
    AI.reduceTaskEither(
      E.toError,
      new Map<string, MessageInfo>(),
      (prev, curr) => {
        curr.forEach(message => {
          prev.set(
            message.senderServiceId,
            updateMessageInfo(prev.get(message.senderServiceId), message)
          );
        });
        return prev;
      }
    ),
    T.map(_ => {
      context.log(`End retrieving data.. ${Date.now()}`);
      context.log(`Start creating csv.. ${Date.now()}`);
      return _;
    }),
    TE.map(_ => {
      // eslint-disable-next-line functional/no-let
      let tot = 0;
      _.forEach(v => {
        tot += v.messages_total;
      });
      context.log("TOTAL: ", tot);
      return _;
    }),
    TE.map(
      // Create csv
      M.reduceWithIndex(S.Ord)(
        "ServiceID\tTOT\tSENT\tPAYMENT\n",
        (key, prev, curr) => {
          // eslint-disable-next-line no-param-reassign
          prev += `${key}\t${curr.messages_total}\t${curr.messages_sent}\t${curr.payment_messages}\n`;
          return prev;
        }
      )
    ),
    T.map(_ => {
      context.log(`End csv.. ${Date.now()}`);
      return _;
    }),
    TE.chain(csv_content =>
      pipe(
        TE.tryCatch(() => {
          const dateStringMin = new Date(rangeMin * 1000).toJSON();
          const dateStringMax = new Date(rangeMax * 1000).toJSON();

          return upsertBlobFromText(
            csvFilesBlobService,
            "messages",
            `${dateStringMin} - ${dateStringMax}.csv`,
            csv_content
          );
        }, E.toError),
        TE.chain(TE.fromEither),
        TE.chain(
          O.fold(
            () => TE.left(Error("blob not created")),
            _ => TE.right(_)
          )
        )
      )
    ),
    T.map(_ => {
      context.log("RESULT: ", _);
      return _;
    }),
    TE.map(_ => ({ isSuccess: true, result: "none" })),
    TE.mapLeft(_ => ({ isSuccess: false, result: "none" })),
    TE.toUnion,
    T.map(toBulkOperationResultEntity("process-messages"))
  )();
