import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";
import {
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { BlobService } from "azure-storage";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import * as E from "fp-ts/Either";
import { OutboundEnricher } from "../port/outbound-enricher";
import { failure, success } from "../port/outbound-publisher";

export const create = (
  messageModel: MessageModel,
  blobService: BlobService,
  maxParallelThrottling: number
): OutboundEnricher<RetrievedMessage> => {
  const enrichASingleMessage = (
    message: RetrievedMessage
  ): TE.TaskEither<Error, RetrievedMessage> =>
    pipe(
      messageModel.getContentFromBlob(blobService, message.id),
      TE.chain(TE.fromOption(() => Error(`Blob not found`))),
      TE.map(content => ({
        ...message,
        content,
        kind: "IRetrievedMessageWithContent"
      }))
    );

  return {
    enrich: enrichASingleMessage,

    enrichs: flow(
      RA.chunksOf(maxParallelThrottling),
      RA.map(
        flow(
          RA.map(message =>
            message.isPending === false
              ? pipe(
                  enrichASingleMessage(message),
                  TE.map(success),
                  TE.mapLeft(error => failure(error, message))
                )
              : TE.of(success(message))
          ),
          RA.sequence(T.ApplicativePar)
        )
      ),
      RA.sequence(T.ApplicativeSeq),
      T.map(RA.flatten),
      T.map(RA.map(E.toUnion))
    )
  };
};
