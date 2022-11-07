import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/Either";
import * as POF from "../predicate-outbound-filterer";
import { Producer, ProducerRecord } from "kafkajs";
import { Predicate } from "fp-ts/lib/Predicate";

const aTopic = "a-topic";
const aDocument = { name: "a-name" };
const anError = new Error("An error");
const aKafkaResponse = {
  errorCode: 0,
  partition: 1,
  topicName: aTopic
};

const predicateMock: Predicate<typeof aDocument> = doc =>
  doc.name === aDocument.name;

describe("filterArray", () => {
  it("GIVEN a valid Predicate Oubound Filterer, WHEN applying to an array of documents, THEN filter out only elements that not satisfy its predicate", async () => {
    // Given
    const adapter = POF.create(predicateMock);
    // When
    const result = adapter.filterArray([aDocument, { name: "aWrongName" }]);
    // Then
    expect(result.length).toBeGreaterThan(0);
    expect(result).toEqual([aDocument]);
  });

  it("GIVEN a valid Predicate Oubound Filterer, WHEN applying to an array of one document, THEN return an empty array if predicate is not satisfied", async () => {
    // Given
    const adapter = POF.create(predicateMock);
    // When
    const result = adapter.filterArray([{ name: "aWrongName" }]);
    // Then
    expect(result.length).toEqual(0);
  });
});
