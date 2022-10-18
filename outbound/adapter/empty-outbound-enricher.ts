import * as TE from "fp-ts/TaskEither";
import { flow } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import { OutboundEnricher } from "../port/outbound-enricher";
import { success } from "../port/outbound-publisher";

export const create = <I>(): OutboundEnricher<I> => ({
  enrich: TE.right,
  enrichs: flow(RA.map(success), T.of)
});
