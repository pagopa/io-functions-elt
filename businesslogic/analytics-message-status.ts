import { RetrievedMessageStatus } from "@pagopa/io-functions-commons/dist/src/models/message_status";
import { constVoid, flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import * as TT from "fp-ts/TaskThese";
import * as RA from "fp-ts/ReadonlyArray";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { OutboundTracker } from "../outbound/port/outbound-tracker";

export const processMessageStatus = (
  tracker: OutboundTracker,
  mainPublisher: OutboundPublisher<RetrievedMessageStatus>,
  fallbackPublisher: OutboundPublisher<RetrievedMessageStatus>,
  documents: ReadonlyArray<unknown>
): T.Task<void> =>
  pipe(
    documents,
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
          TE.toUnion,
          T.map(constVoid)
        )
      )
    ),
    TT.fold(T.sequenceArray, T.sequenceArray, (e, r) =>
      T.sequenceArray(RA.concat(r)(e))
    ),
    T.map(constVoid)
  );
