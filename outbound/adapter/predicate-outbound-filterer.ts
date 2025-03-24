import * as RA from "fp-ts/ReadonlyArray";
import { Predicate } from "fp-ts/lib/Predicate";
import { flow, pipe } from "fp-ts/lib/function";

import { OutboundFilterer } from "../port/outbound-filterer";

export const create = <T>(predicate: Predicate<T>): OutboundFilterer<T> => {
  const applyPredicate = (document: T): boolean => pipe(document, predicate);

  return {
    filterArray: flow(RA.filter(applyPredicate))
  };
};
