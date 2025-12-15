import { Context } from "@azure/functions";

import * as t from "io-ts";
import * as E from "fp-ts/Either";
import * as RA from "fp-ts/ReadonlyArray";
import { pipe } from "fp-ts/lib/function";

import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";

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

export const createContext = (): Context =>
  (({
    bindings: {},
    executionContext: { functionName: "funcname" },
    // eslint-disable-next-line no-console
    log: console.log
  } as unknown) as Context);

export const createContent = (otherContent?: any): MessageContent =>
  pipe(
    {
      subject: "s".repeat(100),
      markdown: "m".repeat(250),
      ...otherContent
    },
    MessageContent.decode,
    E.getOrElseW(_ => {
      throw E.toError(_);
    })
  );
