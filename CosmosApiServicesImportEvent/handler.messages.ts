import { Context } from "@azure/functions";
import { BlobService } from "azure-storage";

import { flow, pipe } from "fp-ts/lib/function";
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
  MessageWithContent,
  RetrievedMessage,
  RetrievedMessageWithContent
} from "@pagopa/io-functions-commons/dist/src/models/message";

import * as AI from "../utils/AsyncIterableTask";
import {
  IBulkOperationResultEntity,
  toBulkOperationResultEntity
} from "../utils/bulkOperationResult";
import {
  MessageReport,
  PaymentMessage,
  RetrievedNotPendingMessage
} from "../utils/types/reportTypes";

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
          m.isPending === undefined || m.isPending
            ? T.of(m)
            : enrichMessageContent(messageModel, blobService, m)
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
    value =>
      value ?? {
        serviceId: message.senderServiceId,
        // eslint-disable-next-line sort-keys
        sent: 0,
        // eslint-disable-next-line sort-keys
        delivered: 0,
        delivered_payment: 0,
        with_content: 0
      },
    value => ({
      serviceId: value.serviceId,
      // eslint-disable-next-line sort-keys
      sent: value.sent + 1,
      // eslint-disable-next-line sort-keys
      delivered:
        value.delivered + (RetrievedNotPendingMessage.is(message) ? 1 : 0),
      delivered_payment:
        value.delivered_payment + (PaymentMessage.is(message) ? 1 : 0),
      with_content:
        value.with_content + (MessageWithContent.is(message) ? 1 : 0)
    })
  );

const toJSONString = flow(
  M.reduce(S.Ord)<
    // eslint-disable-next-line functional/prefer-readonly-type
    MessageReport[],
    MessageReport
  >([], (prev, curr) => {
    // eslint-disable-next-line functional/immutable-data
    prev.push(curr);
    return prev;
  }),
  JSON.stringify
);

// ------------------
// Process report
// ------------------

/**
 * Process all messages between min and max timestamp values
 * and write a csv into blob storage
 */
export const processMessages = (
  messageModel: MessageModel,
  blobService: BlobService,
  exportToBlob: (
    blobName: string
  ) => (text: string) => TE.TaskEither<Error, BlobService.BlobResult>,
  cosmosChunkSize: number,
  cosmosDegreeeOfParallelism: number,
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
    AI.map(page => {
      const [rights, lefts] = [RA.rights(page), RA.lefts(page)];
      if (lefts.length > 0) {
        context.log(`ERROR: ${lefts.length} messages metadata not loaded`);
      }
      return rights;
    }),
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
      new Map<string, MessageReport>(),
      (prev, curr) => {
        curr.forEach(message => {
          prev.set(
            message.senderServiceId,
            updateMessageReport(prev.get(message.senderServiceId), message)
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
        tot += v.sent;
      });
      context.log("TOTAL: ", tot);
      return _;
    }),
    TE.map(
      // Create csv
      toJSONString
    ),
    T.map(_ => {
      context.log(`End csv.. ${Date.now()}`);
      return _;
    }),
    TE.chain(content => {
      const dateStringMin = new Date(rangeMin * 1000).toJSON();
      const dateStringMax = new Date(rangeMax * 1000).toJSON();
      return exportToBlob(`${dateStringMin} - ${dateStringMax}.json`)(content);
    }),
    T.map(_ => {
      context.log("RESULT SUCCESS: ", E.isRight(_));
      return _;
    }),
    TE.map(_ => ({ isSuccess: true, result: "none" })),
    TE.mapLeft(_ => ({ isSuccess: false, result: "none" })),
    TE.toUnion,
    T.map(toBulkOperationResultEntity("process-message-report"))
  )();
