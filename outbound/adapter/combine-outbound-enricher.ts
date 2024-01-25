import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import { OutboundEnricher } from "../port/outbound-enricher";
import { isFailure, isSuccess } from "../port/outbound-publisher";

export const create = <I>(
  first: OutboundEnricher<I>,
  second: OutboundEnricher<I>
): OutboundEnricher<I> => ({
  enrich: flow(first.enrich, TE.chain(second.enrich)),
  enrichs: flow(
    first.enrichs,
    T.chain(firstResults =>
      pipe(
        firstResults,
        RA.filter(isSuccess),
        RA.map(s => s.document),
        second.enrichs,
        T.map(secondResults =>
          pipe(firstResults, RA.filter(isFailure), RA.concat(secondResults))
        )
      )
    )
  )
});
