import { constVoid, flow, identity, pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TT from "fp-ts/TaskThese";
import * as RA from "fp-ts/ReadonlyArray";
import * as O from "fp-ts/Option";
import * as S from "fp-ts/string";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { not } from "fp-ts/lib/Predicate";
import * as t from "io-ts";
import * as logger from "winston";
import {
  isFailure,
  isSuccess,
  OutboundPublisher
} from "../outbound/port/outbound-publisher";
import { OutboundTracker } from "../outbound/port/outbound-tracker";
import { InboundDocumentsProcessor } from "../inbound/port/inbound-documents-processor";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { OutboundFilterer } from "../outbound/port/outbound-filterer";
import * as DOF from "../outbound/adapter/allow-all-outbound-filterer";

export const getAnalyticsProcessorForDocuments = <I>(
  decoder: t.Decoder<unknown, I>,
  tracker: OutboundTracker,
  contentEnricher: OutboundEnricher<I>,
  mainPublisher: OutboundPublisher<I>,
  fallbackPublisher: OutboundPublisher<I>,
  dataFilterer: OutboundFilterer<I> = DOF.create()
  // eslint-disable-next-line max-params
): InboundDocumentsProcessor => ({
  process: flow(
    x => {
      logger.debug(
        `starting to process ${x === null ? "NULL" : x.length} documents`
      );
      return x;
    },
    RA.map(decoder.decode),
    documentsOrErrors =>
      TT.both(RA.lefts(documentsOrErrors), RA.rights(documentsOrErrors)),
    TT.mapLeft(
      flow(
        x => {
          logger.debug(`failed to decode ${x.length} documents`);
          return x;
        },
        RA.map(
          flow(
            readableReport,
            message => tracker.trackError(new Error(message)),
            T.of
          )
        ),
        T.sequenceArray,
        T.map(constVoid)
      )
    ),
    TT.map(
      flow(
        x => {
          logger.debug(`processing ${x.length} documents`);
          return x;
        },
        dataFilterer.filterArray,
        x => {
          logger.debug(`enriching ${x.length} documents`);
          return x;
        },
        // Enrich and publish documents with the main publisher, then return the errors
        contentEnricher.enrichs,
        T.chain(enrichResults =>
          pipe(
            enrichResults,
            RA.filter(isSuccess),
            RA.map(success => success.document),
            x => {
              logger.debug(
                `publishing ${x.length} documents via main publisher`
              );
              return x;
            },
            mainPublisher.publishes,
            T.map(RA.concat(enrichResults)),
            T.map(RA.filter(isFailure)),
            T.map(x => {
              logger.debug(
                `failed to publishing ${
                  x.length
                } documents, preparing to publish them via fallback publisher. Errors: [${pipe(
                  x,
                  RA.map(d => d.error),
                  RA.reduce("", (acc, next) => `${acc}|${JSON.stringify(next)}`)
                )}]`
              );
              return x;
            })
          )
        ),
        // Publish documents in error with the fallback publisher: if the fallback fails, throw an error
        T.chain(faileds =>
          pipe(
            faileds,
            RA.map(failed => failed.document),
            x => {
              logger.debug(
                `publishing ${
                  x.length
                } documents via fallback publisher. IDs [${pipe(
                  x,
                  RA.map(d =>
                    "id" in d
                      ? ((d as unknown) as { readonly id: string }).id
                      : "NO_ID"
                  ),
                  RA.reduce("", (acc, next) => `${acc}|${next}`)
                )}]`
              );
              return x;
            },
            fallbackPublisher.publishes,
            T.map(RA.filter(isFailure)),
            T.map(x => {
              logger.debug(
                `failed to publishing ${x.length} documents via fallback publisher`
              );
              return x;
            }),
            T.map(ffs =>
              ffs.length === 0
                ? ""
                : pipe(
                    ffs,
                    RA.concat(faileds),
                    RA.reduce(
                      "",
                      (message, failure) =>
                        `${message}|${failure.error.message}`
                    )
                  )
            ),
            T.map(
              flow(
                O.fromPredicate(not(S.isEmpty)),
                O.map(errorMessage => {
                  logger.debug(
                    `failed to publishing documents via fallback publisher due to ${errorMessage}`
                  );
                  throw new Error(errorMessage);
                }),
                constVoid
              )
            )
          )
        )
      )
    ),
    TT.fold(identity, identity, (errorTasks, publishTasks) =>
      pipe(
        errorTasks,
        T.chain(() => publishTasks)
      )
    )
  )
});
