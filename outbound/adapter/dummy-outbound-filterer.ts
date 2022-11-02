import { identity } from "fp-ts/lib/function";
import { some } from "fp-ts/lib/Option";
import { OutboundFilterer } from "../port/outboud-filterer";

export const create = <I>(): OutboundFilterer<I> => ({
  filter: some,
  filterArray: identity
});
