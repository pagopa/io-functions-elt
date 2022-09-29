import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { QueueClient } from "@azure/storage-queue";
import { pipe } from "fp-ts/lib/function";
import * as QA from "../queue-outbound-publisher";

const mockSendMessage = jest.fn(() => Promise.resolve());
const mockQueueClient = ({
  sendMessage: mockSendMessage
} as unknown) as QueueClient;

const aDocument = { name: "a-name" };
const anError = new Error("An error");

describe("publish", () => {
  it("GIVEN a valid Storage Queue Client, WHEN publishing a document, THEN store it in the queue and return a right either", async () => {
    // Given
    const adapter = QA.create(mockQueueClient);
    // When
    const publishedOrError = await adapter.publish(aDocument)();
    // Then
    expect(E.isRight(publishedOrError)).toBeTruthy();
    expect(mockSendMessage).toHaveBeenCalledWith(
      Buffer.from(JSON.stringify(aDocument)).toString("base64")
    );
  });

  it("GIVEN a not working Storage Queue Client, WHEN publishing a document, THEN throw an exception", async () => {
    // Given
    mockSendMessage.mockImplementationOnce(async () => {
      throw anError;
    });
    const adapter = QA.create(mockQueueClient);
    // When
    const publishedOrError = await adapter.publish(aDocument)();
    // Then
    expect(E.isLeft(publishedOrError)).toBeTruthy();
    expect(mockSendMessage).toHaveBeenCalledWith(
      Buffer.from(JSON.stringify(aDocument)).toString("base64")
    );
  });
});
