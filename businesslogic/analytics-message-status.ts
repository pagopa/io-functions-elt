import { RetrievedMessageStatus } from "@pagopa/io-functions-commons/dist/src/models/message_status";
import { constVoid, flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import * as TT from "fp-ts/TaskThese";
import * as RA from "fp-ts/ReadonlyArray";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { OutboundTracker } from "../outbound/port/outbound-tracker";
import { InboundDocumentsProcessor } from "../inbound/port/inbound-documents-processor";

export const getAnalyticsProcessForMessageStatus = (
  tracker: OutboundTracker,
  mainPublisher: OutboundPublisher<RetrievedMessageStatus>,
  fallbackPublisher: OutboundPublisher<RetrievedMessageStatus>
): InboundDocumentsProcessor => ({
  process: flow(
    RA.map(RetrievedMessageStatus.decode),
    messageStatusOrErrors =>
      TT.both(
        RA.lefts(messageStatusOrErrors),
        RA.rights(messageStatusOrErrors)
      ),
    TT.mapLeft(
      RA.map(
        flow(
          readableReport,
          message => tracker.trackError(new Error(message)),
          T.of
        )
      )
    ),
    TT.map(
      RA.map(messageStatus =>
        pipe(
          mainPublisher.publish(messageStatus),
          TE.orElse(_error => fallbackPublisher.publish(messageStatus)),
          TE.mapLeft(error => {
            throw error;
          }),
          TE.toUnion,
          T.map(constVoid)
        )
      )
    ),
    TT.fold(T.sequenceArray, T.sequenceArray, (errorTasks, publishTasks) =>
      T.sequenceArray(RA.concat(publishTasks)(errorTasks))
    ),
    T.map(constVoid)
  )
});
