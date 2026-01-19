import { Context } from "@azure/functions";
import {
  Message,
  MessageModel,
  RetrievedMessage,
  RetrievedMessageWithContent
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { BlobService } from "azure-storage";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as t from "io-ts";

import * as AI from "../utils/AsyncIterableTask";
import {
  IBulkOperationResultEntity,
  toBulkOperationResultEntity
} from "../utils/bulkOperationResult";
import {
  MessageReport,
  PaymentMessage,
  RetrievedNotPendingMessage,
  WithContentMessage
} from "../utils/types/reportTypes";

const testUsers: readonly string[] = [
  "AAAAAA00A00A000A",
  "EEEEEE00E00E000A",
  "EEEEEE00E00E000B",
  "EEEEEE00E00E000C",
  "EEEEEE00E00E000D",
  "AAAAAA00A00A000C",
  "AAAAAA00A00A000D",
  "AAAAAA00A00A000E",
  "PRVPRV25A01H501B",
  "XXXXXP25A01H501L",
  "YYYYYP25A01H501K",
  "KKKKKP25A01H501U",
  "QQQQQP25A01H501S",
  "WWWWWP25A01H501A",
  "ZZZZZP25A01H501J",
  "JJJJJP25A01H501X",
  "GGGGGP25A01H501Z"
];

/**
 * Build a Cosmos query iterator for messages with a min and max timestamp.
 */
export const buildIterator =
  (
    messageModel: MessageModel,
    cosmosChunkSize: number,
    cosmosDegreeeOfParallelism: number
  ) =>
  (
    rangeMin: number,
    rangeMax: number
  ): AsyncIterable<readonly t.Validation<RetrievedMessage>[]> =>
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
          },
          {
            name: "@testUsers",
            value: testUsers
          }
        ],
        query: `SELECT * FROM m WHERE m._ts > @min AND m._ts <= @max AND NOT ARRAY_CONTAINS(@testUsers, m.fiscalCode)`
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
  message: RetrievedMessage,
  context: Context
): T.Task<RetrievedMessage | RetrievedMessageWithContent> =>
  pipe(
    messageModel.getContentFromBlob(blobService, message.id),
    TE.chain(
      O.fold(
        () => TE.left(Error("blob not found")),
        (_) => TE.right(_)
      )
    ),
    TE.map((content) => ({ ...message, content })),
    TE.orElseW((_e) => {
      context.log(`Error retrieving message ${message.id}`, _e.message);
      return TE.right(message);
    }),
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
  messages: readonly RetrievedMessage[],
  context: Context
): T.Task<readonly (RetrievedMessage | RetrievedMessageWithContent)[]> =>
  pipe(
    messages,
    RA.chunksOf(mesageContentChunkSize),
    RA.map((chunks) =>
      pipe(
        chunks,
        RA.map((m) =>
          m.isPending === false
            ? enrichMessageContent(messageModel, blobService, m, context)
            : T.of(m)
        ),
        RA.sequence(T.ApplicativePar)
      )
    ),
    RA.sequence(T.ApplicativeSeq),
    T.map(RA.flatten)
  );

/**
 * return an updated MessageReport, based on `message` values
 */
const updateMessageReport = (
  curr: MessageReport | undefined,
  message: Message
): MessageReport =>
  pipe(
    curr,
    (value) =>
      value ?? {
        delivered: 0,
        delivered_payment: 0,

        sent: 0,
        serviceId: message.senderServiceId,
        with_content: 0
      },
    (value) => ({
      delivered:
        value.delivered + (RetrievedNotPendingMessage.is(message) ? 1 : 0),
      delivered_payment:
        value.delivered_payment + (PaymentMessage.is(message) ? 1 : 0),

      sent: value.sent + 1,
      serviceId: value.serviceId,
      with_content:
        value.with_content + (WithContentMessage.is(message) ? 1 : 0)
    })
  );

const toJSONString = (map: ReadonlyMap<string, MessageReport>): string =>
  pipe(map, (m) => Array.from(m.values()), JSON.stringify);

// ------------------
// Process report
// ------------------

/**
 * Process all messages between min and max timestamp values
 * and write a csv into blob storage
 */
export const processMessages =
  (
    messageModel: MessageModel,
    blobService: BlobService,
    exportToBlob: (
      blobName: string
    ) => (text: string) => TE.TaskEither<Error, BlobService.BlobResult>,
    cosmosChunkSize: number,
    cosmosDegreeeOfParallelism: number,
    mesageContentChunkSize: number
  ) =>
  async (
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
      AI.map((page) => {
        const [rights, lefts] = [RA.rights(page), RA.lefts(page)];
        if (lefts.length > 0) {
          context.log(`ERROR: ${lefts.length} messages metadata not loaded`);
        }
        return rights;
      }),
      AI.map((messages) =>
        enrichMessagesContent(
          messageModel,
          mesageContentChunkSize,
          blobService,
          messages,
          context
        )()
      ),
      T.map((_) => {
        context.log(`[${rangeMin}] Start retrieving data.. ${Date.now()}`);
        return _;
      }),
      AI.reduceTaskEither(
        E.toError,
        new Map<string, MessageReport>(),
        (prev, curr) => {
          curr.forEach((message) => {
            prev.set(
              message.senderServiceId,
              updateMessageReport(prev.get(message.senderServiceId), message)
            );
          });
          return prev;
        }
      ),
      T.map((_) => {
        context.log(`[${rangeMin}] End retrieving data.. ${Date.now()}`);
        return _;
      }),
      TE.map((_) => {
        let tot = 0;
        let withoutContent = 0;
        _.forEach((v) => {
          tot += v.sent;
          withoutContent += v.delivered !== v.with_content ? 1 : 0;
        });
        context.log(`[${rangeMin}] Total: ${tot}`);
        context.log(`[${rangeMin}] Without content: ${withoutContent}`);
        return _;
      }),
      TE.map(
        // Create csv
        toJSONString
      ),
      T.map((_) => {
        context.log(`[${rangeMin}] End csv.. ${Date.now()}`);
        return _;
      }),
      TE.chain((content) => {
        const dateStringMin = new Date(rangeMin * 1000).toJSON();
        const dateStringMax = new Date(rangeMax * 1000).toJSON();
        return exportToBlob(`step1_${dateStringMin} - ${dateStringMax}.json`)(
          content
        );
      }),
      T.map((_) => {
        context.log(`[${rangeMin}] Result success:  ${E.isRight(_)}`);
        return _;
      }),
      TE.map(() => ({ isSuccess: true, result: "none" })),
      TE.mapLeft(() => ({ isSuccess: false, result: "none" })),
      TE.toUnion,
      T.map(toBulkOperationResultEntity("process-message-report"))
    )();
