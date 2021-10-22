import { number } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import { forEach } from "lodash";
import * as AI from "../AsyncIterableTask";

async function* yield123() {
  for (let i = 1; i <= 3; i++) {
    yield i;
  }
}

describe("AsyncIterableTask", () => {
  it("fold - should read all values", async () => {
    const asyncIterable = yield123();
    const asyncIterator = asyncIterable[Symbol.asyncIterator]();

    const res = await pipe(
      asyncIterator,
      AI.fromAsyncIterable,
      AI.map(v => v + 1),
      AI.fold
    )();

    expect(res).toEqual([2, 3, 4]);
  });

  it("run - should process all values", async () => {
    const asyncIterable = yield123();
    const asyncIterator = asyncIterable[Symbol.asyncIterator]();

    let elements = 0;

    const res = await pipe(
      asyncIterator,
      AI.fromAsyncIterable,
      AI.map(v => {
        elements++;
        return v + 1;
      }),
      AI.run
    )();

    expect(elements).toEqual(3);
    expect(res).toBeUndefined();
  });
});
