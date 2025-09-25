import { pipe } from "fp-ts/function";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import { gunzipSync } from "zlib";

/**
 * io-ts decoder for a base64 encoded gzipped string
 *
 * NOTE: Decodes into a string
 * Encode into itself, compression not supported
 * Supports UTF-8 characters
 */
export const GzipCompressedString = new t.Type<string, unknown>(
  "GzipCompressedString",
  t.string.is,
  (i, c) =>
    pipe(
      t.string.validate(i, c),
      E.mapLeft(() => t.failure<string>(i, c, "Invalid string in input")),
      E.chain((s) =>
        E.tryCatch(
          () => Buffer.from(s, "base64"),
          (e) => t.failure(i, c, `Base64 decode failed: ${e}`)
        )
      ),
      E.chain((buffer) =>
        E.tryCatch(
          () => gunzipSync(buffer).toString(),
          (e) => t.failure(i, c, `Could not gunzip: ${e}`)
        )
      ),
      E.map(t.success),
      E.getOrElseW(t.identity)
    ),
  t.identity
);
export type GzipCompressedString = t.TypeOf<typeof GzipCompressedString>;
