import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";

import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import * as E from "fp-ts/Either";
import { TelemetryClient } from "applicationinsights";
import { RedisClientType } from "redis";
import { Second } from "@pagopa/ts-commons/lib/units";
import { OutboundEnricher } from "../port/outbound-enricher";
import { failure, success } from "../port/outbound-publisher";
import { getPdvId } from "../../utils/pdv";
import {
  RetrievedProfileWithMaybePdvId,
  RetrievedServicePreferenceWithMaybePdvId,
  RetrievedUserDataProcessingWithMaybePdvId
} from "../../utils/types/decoratedTypes";
import { PdvTokenizerClient } from "../../utils/pdvTokenizerClient";

export type MaybePdvDocumentsTypes =
  | RetrievedServicePreferenceWithMaybePdvId
  | RetrievedProfileWithMaybePdvId
  | RetrievedUserDataProcessingWithMaybePdvId;

export const create = <M extends MaybePdvDocumentsTypes>(
  maxParallelThrottling: number,
  pdvTokenizerClient: PdvTokenizerClient,
  redisClientTask: TE.TaskEither<Error, RedisClientType>,
  PDVIdKeyTTLinSeconds: Second,
  appInsightsTelemetryClient: TelemetryClient
): OutboundEnricher<M> => {
  const enrichASingleMessage = (message: M): TE.TaskEither<Error, M> =>
    pipe(
      {
        PDVIdKeyTTLinSeconds,
        appInsightsTelemetryClient,
        pdvTokenizerClient,
        redisClientTask
      },
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
