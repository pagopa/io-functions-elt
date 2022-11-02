import { identity } from "fp-ts/lib/function";
import { OutboundFilterer } from "../port/outbound-filterer";

export const create = <I>(): OutboundFilterer<I> => ({
  filterArray: identity
});
