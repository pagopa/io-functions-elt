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
  it("should work", async () => {
    const asyncIterable = yield123();
    const asyncIterator = asyncIterable[Symbol.asyncIterator]();

    for await (let variable of asyncIterator) {
      console.log(variable);
    }
  });
  it("should read all values", async () => {
    const asyncIterable = yield123();
    const asyncIterator = asyncIterable[Symbol.asyncIterator]();

    const res = await pipe(
      asyncIterator,
      x => x,
      AI.fromAsyncIterable,
      AI.map(v => {
        console.log("Value " + v);
        return v + 1;
      }),
      AI.fold
    )();

    console.log(res);

    return res;
  });
  it("should read all values", async () => {
    const asyncIterable = yield123();
    const asyncIterator = asyncIterable[Symbol.asyncIterator]();

    const res = await pipe(
      asyncIterator,
      x => x,
      AI.fromAsyncIterable,
      AI.map(v => {
        console.log("Value " + v);
        return v + 1;
      }),
      AI.run
    )();

    console.log(res);

    return res;
  });
});
