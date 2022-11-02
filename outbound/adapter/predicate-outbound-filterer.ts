import { Predicate } from "fp-ts/lib/Predicate";
import * as O from "fp-ts/Option";
import { flow, pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import { OutboundFilterer } from "../port/outboud-filterer";

export const create = <T>(predicate: Predicate<T>): OutboundFilterer<T> => {
  const applyPredicate = (document: T): boolean => pipe(document, predicate);

  return {
    filter: flow(O.fromPredicate(applyPredicate)),
    filterArray: flow(RA.filter(applyPredicate))
  };
};
