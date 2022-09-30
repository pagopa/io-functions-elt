import { constVoid, flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import * as TT from "fp-ts/TaskThese";
import * as RA from "fp-ts/ReadonlyArray";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { OutboundTracker } from "../outbound/port/outbound-tracker";

export const processService = (
  tracker: OutboundTracker,
  mainPublisher: OutboundPublisher<RetrievedService>,
  fallbackPublisher: OutboundPublisher<RetrievedService>,
  documents: ReadonlyArray<unknown>
): T.Task<void> =>
  pipe(
    documents,
    RA.map(RetrievedService.decode),
    serviceOrErrors =>
      TT.both(RA.lefts(serviceOrErrors), RA.rights(serviceOrErrors)),
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
      RA.map(service =>
        pipe(
          mainPublisher.publish(service),
          TE.orElse(_error => fallbackPublisher.publish(service)),
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
  );
