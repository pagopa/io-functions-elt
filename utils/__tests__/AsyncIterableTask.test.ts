import { number } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import { forEach } from "lodash";
import * as AI from "../AsyncIterableTask";

import * as E from "fp-ts/lib/Either";
import { identity } from "fp-ts/lib/function";

async function* yieldValues<T>(elements: T[]): AsyncIterable<T> {
  for (const e of elements) {
    yield e;
  }
}

async function* yieldThrowError<T>(
  elements: T[],
  throwAtIndex: number
): AsyncIterable<T> {
  for (let i = 0; i <= elements.length; i++) {
    if (i < throwAtIndex) yield elements[i];
    else throw Error("an Error");
  }
}

describe("AsyncIterableTask", () => {
  it("run - should process all values", async () => {
    const originalValues = [1, 2, 3];
    const mapfn = (v: number) => v + 1;
    const expectedValues = originalValues.map(mapfn);
    const asyncIterable = yieldValues(originalValues);

    let elements = 0;

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.map(v => {
        elements++;
        return mapfn(v);
      }),
      AI.run
    )();

    expect(elements).toEqual(3);
    expect(res).toBeUndefined();
  });

  it("fold - should read all values", async () => {
    const originalValues = [1, 2, 3];
    const mapfn = (v: number) => v + 1;
    const expectedValues = originalValues.map(mapfn);
    const asyncIterable = yieldValues(originalValues);

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.map(mapfn),
      AI.fold
    )();

    expect(res).toEqual(expectedValues);
  });

  it("foldTaskEither - should process all values", async () => {
    const originalValues = [1, 2, 3];
    const mapfn = (v: number) => v + 2;
    const expectedValues = originalValues.map(mapfn);
    const asyncIterable = yieldValues(originalValues);

    let elements = 0;

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.map(v => {
        elements++;
        return mapfn(v);
      }),
      AI.foldTaskEither(identity)
    )();

    expect(elements).toEqual(3);

    pipe(
      res,
      E.map(val => expect(val).toEqual(expectedValues)),
      E.mapLeft(_ => fail("Error retrieving values"))
    );
  });

  it("foldTaskEither - should handle Errors", async () => {
    const originalValues = [1, 2, 3];
    const mapfn = (v: number) => v + 2;
    const asyncIterable = yieldThrowError(originalValues, 2);

    let elements = 0;

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.map(v => {
        elements++;
        return mapfn(v);
      }),
      AI.foldTaskEither(identity)
    )();

    expect(elements).toEqual(2);

    pipe(
      res,
      E.map(val => fail("Exception not handled")),
      E.mapLeft(err => expect(err).toEqual(Error("an Error")))
    );
  });

  it("reduceTaskEither - should reduce all values", async () => {
    const originalValues = [[1, 2], [2, 3], [3]];
    const asyncIterable = yieldValues(originalValues);

    const expected: Map<number, number> = new Map([
      [1, 1],
      [2, 2],
      [3, 2]
    ]);

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.reduceTaskEither(identity, new Map<number, number>(), (prev, curr) => {
        curr.forEach(c => {
          prev.set(c, (prev.get(c) ?? 0) + 1);
        });
        return prev;
      })
    )();

    pipe(
      res,
      E.map(val => expect(val).toEqual(expected)),
      E.mapLeft(_ => fail("Error retrieving values"))
    );
  });
});
