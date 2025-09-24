import { GzipCompressedString } from "../gzipCompressedString";
import { gzipSync } from "zlib";
import * as E from "fp-ts/lib/Either";

describe("GzipCompressedString decoder", () => {
  const encodeBase64 = (buf: Buffer) => buf.toString("base64");

  it("should decode a correct base64 encoded gzip string", () => {
    const original = "hello, world!";
    const gz = gzipSync(original);
    const b64 = encodeBase64(gz);

    const result = GzipCompressedString.decode(b64);
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right).toBe(original);
    }
  });

  it.each`
    scenario                  | input
    ${"non base64 string"}    | ${"##@@"}
    ${"wrong base64 padding"} | ${"ZXhhbXBsZQ="}
    ${"illegal base64 chars"} | ${"ZXhhbXBsZQ$%"}
  `("should fail on $scenario", ({ input }) => {
    const res = GzipCompressedString.decode(input);
    expect(E.isLeft(res)).toBe(true);
  });

  it("should fail on valid base64 data but no gzipped", () => {
    const notGzip = Buffer.from("example", "utf-8");
    // no gzip
    const b64 = encodeBase64(notGzip);

    const res = GzipCompressedString.decode(b64);
    expect(E.isLeft(res)).toBe(true);
  });

  it.each`
    scenario               | input
    ${"empy string"}       | ${""}
    ${"only space string"} | ${"     "}
  `("should fail on $scenario", ({ input }) => {
    const res = GzipCompressedString.decode(input);
    expect(E.isLeft(res)).toBe(true);
  });

  it("should support multiline and unicode", () => {
    const original = "Linea1\nLinea2 — αβγ\nemoji: 😄";
    const gz = gzipSync(Buffer.from(original, "utf-8"));
    const b64 = gz.toString("base64");

    const res = GzipCompressedString.decode(b64);
    expect(E.isRight(res)).toBe(true);
    if (E.isRight(res)) {
      expect(res.right).toBe(original);
    }
  });
});
