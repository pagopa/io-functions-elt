import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";
import {
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { BlobService } from "azure-storage";
import * as TT from "fp-ts/TaskThese";
import * as TH from "fp-ts/These";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import { OutboundEnricher } from "../port/outbound-enricher";

const DEFAULT_THROTTLING = 500;

export const create = (
  messageModel: MessageModel,
  blobService: BlobService,
  maxParallelThrottling: number = DEFAULT_THROTTLING
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
    enrich: (
      message: RetrievedMessage
    ): TE.TaskEither<Error, RetrievedMessage> => enrichASingleMessage(message),

    enrichs: (
      messages: ReadonlyArray<RetrievedMessage>
    ): TT.TaskThese<
      ReadonlyArray<RetrievedMessage>,
      ReadonlyArray<RetrievedMessage>
    > =>
      pipe(
        messages,
        RA.chunksOf(maxParallelThrottling),
        RA.map(
          flow(
            RA.map(m =>
              m.isPending === false
                ? pipe(
                    enrichASingleMessage(m),
                    TE.mapLeft(() => m)
                  )
                : TE.of(m)
            ),
            RA.sequence(T.ApplicativePar)
          )
        ),
        RA.sequence(T.ApplicativeSeq),
        T.map(RA.flatten),
        T.map(enrichedMessages =>
          TH.both(RA.lefts(enrichedMessages), RA.rights(enrichedMessages))
        )
      )
  };
};
