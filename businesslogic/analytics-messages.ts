import { constVoid, flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import * as TT from "fp-ts/TaskThese";
import * as RA from "fp-ts/ReadonlyArray";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { RetrievedMessage } from "@pagopa/io-functions-commons/dist/src/models/message";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { OutboundTracker } from "../outbound/port/outbound-tracker";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { InboundDocumentsProcessor } from "../inbound/port/inbound-documents-processor";

export const getAnalyticsProcessorForMessages = (
  tracker: OutboundTracker,
  contentEnricher: OutboundEnricher<RetrievedMessage>,
  mainPublisher: OutboundPublisher<RetrievedMessage>,
  fallbackPublisher: OutboundPublisher<RetrievedMessage>
): InboundDocumentsProcessor => ({
  process: flow(
    RA.map(RetrievedMessage.decode),
    messageOrErrors =>
      TT.both(RA.lefts(messageOrErrors), RA.rights(messageOrErrors)),
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
      RA.map(message =>
        pipe(
          message.isPending === false
            ? contentEnricher.enrich(message)
            : TE.of(message),
          TE.chain(mainPublisher.publish),
          TE.orElse(_error => fallbackPublisher.publish(message)),
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
