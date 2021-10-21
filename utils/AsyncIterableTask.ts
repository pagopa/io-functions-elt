/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/prefer-readonly-type */
/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
/* eslint-disable prefer-const */
// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

import * as T from "fp-ts/lib/Task";

import { mapAsyncIterable } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { pipe } from "fp-ts/lib/function";

/**
 * @category model
 * @since 2.0.0
 */
export type AsyncIterableTask<A> = T.Task<AsyncIterable<A>>;

/**
 * `map` can be used to turn functions `(a: A) => B` into functions `(fa: F<A>) => F<B>` whose argument and return types
 * use the type constructor `F` to represent some computational context.
 *
 * @category Functor
 * @since 2.0.0
 */
export const map: <A, B>(
  f: (a: A) => B
) => // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
(fa: AsyncIterableTask<A>) => AsyncIterableTask<B> = f => fa =>
  pipe(
    fa,
    T.map(_ => mapAsyncIterable(_, f))
  );

export const fromAsyncIterable = <A>(
  a: AsyncIterable<A>
): AsyncIterableTask<A> => T.of(a);

export const fold = <A>(fa: AsyncIterableTask<A>): T.Task<ReadonlyArray<A>> =>
  pipe(
    fa,
    T.chain(_ => async () => {
      let array: Array<A> = [];
      for await (const variable of _) {
        array.push(variable);
      }
      return array as ReadonlyArray<A>;
    })
  );

export const run = <A>(fa: AsyncIterableTask<A>): T.Task<void> =>
  pipe(
    fa,
    T.chain(asyncIterable => async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of asyncIterable) {
        // nothing to do: this is done to resolve the async iterator
      }
    })
  );
