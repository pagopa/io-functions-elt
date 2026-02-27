import { InvocationContext } from "@azure/functions";

import * as t from "io-ts";
import * as RA from "fp-ts/ReadonlyArray";
import { pipe } from "fp-ts/lib/function";

export async function* buildServiceIterator<C extends t.Mixed>(
  list: ReadonlyArray<unknown>,
  codec: C,
  errorToThrow?: Error
): AsyncIterable<ReadonlyArray<t.Validation<t.TypeOf<C>>>> {
  if (errorToThrow) {
    throw errorToThrow;
  }

  for (const p of pipe(list, RA.map(codec.decode), RA.chunksOf(2))) {
    yield p;
  }
}

export const createContext = (): InvocationContext =>
  ({
    bindings: {},
    executionContext: { functionName: "funcname" },
    // eslint-disable-next-line no-console
    log: console.log,
    debug: console.log,
    error: console.error,
    warn: console.warn
  }) as unknown as InvocationContext;
