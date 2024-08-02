import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";

import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import * as E from "fp-ts/Either";
import { OutboundEnricher } from "../port/outbound-enricher";
import { failure, success } from "../port/outbound-publisher";
import { getPdvId } from "../../utils/pdv";
import { RetrievedServicePreferenceWithMaybePdvId } from "../../AnalyticsServicePreferencesChangeFeedInboundProcessorAdapter";

export const create = <M extends RetrievedServicePreferenceWithMaybePdvId>(
  maxParallelThrottling: number
): OutboundEnricher<M> => {
  const enrichASingleMessage = (message: M): TE.TaskEither<Error, M> =>
    pipe(
      getPdvId(message.fiscalCode),
      TE.map(userPDVId => ({
        ...message,
        userPDVId
      }))
    );

  return {
    enrich: enrichASingleMessage,

    enrichs: flow(
      RA.chunksOf(maxParallelThrottling),
      RA.map(
        flow(
          RA.map(servicePreference =>
            pipe(
              enrichASingleMessage(servicePreference),
              TE.map(success),
              TE.mapLeft(error => failure(error, servicePreference))
            )
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
