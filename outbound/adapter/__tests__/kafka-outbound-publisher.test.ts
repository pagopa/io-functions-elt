import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/Either";
import * as KA from "../kafka-outbound-publisher";
import { Producer, ProducerRecord, RecordMetadata } from "kafkajs";

const aTopic = "a-topic";
const aDocument = { name: "a-name" };
const anError = new Error("An error");
const aKafkaResponse = {
  errorCode: 0,
  partition: 1,
  topicName: aTopic
};

const mockSendMessage = jest.fn(async (pr: ProducerRecord) =>
  pipe(
    pr.messages,
    RA.map(() => aKafkaResponse)
  )
);
const producerMock = () => ({
  producer: ({
    connect: jest.fn(async () => void 0),
    disconnect: jest.fn(async () => void 0),
    send: mockSendMessage
  } as unknown) as Producer,
  topic: { topic: aTopic }
});

describe("publish", () => {
  it("GIVEN a valid Kafka Publisher Client, WHEN publishing a document, THEN publish it to the topic and return a right either", async () => {
    // Given
    const adapter = KA.create(producerMock);
    // When
    const publishedOrError = await adapter.publish(aDocument)();
    // Then
    expect(E.isRight(publishedOrError)).toBeTruthy();
    expect(mockSendMessage).toHaveBeenCalledWith({
      messages: [{ value: JSON.stringify(aDocument) }],
      topic: aTopic
    });
  });

  it("GIVEN a not working Kafka Publisher  Client, WHEN publishing a document, THEN return a left", async () => {
    // Given
    mockSendMessage.mockImplementationOnce(async () => {
      throw anError;
    });
    const adapter = KA.create(producerMock);
    // When
    const publishedOrError = await adapter.publish(aDocument)();
    // Then
    expect(E.isLeft(publishedOrError)).toBeTruthy();
    expect(mockSendMessage).toHaveBeenCalledWith({
      messages: [{ value: JSON.stringify(aDocument) }],
      topic: aTopic
    });
  });

  it("GIVEN a error returning Kafka Publisher Client, WHEN publishing a document, THEN return a left", async () => {
    // Given
    mockSendMessage.mockImplementationOnce(async (pr: ProducerRecord) =>
      pipe(
        pr.messages,
        RA.map(() => ({ ...aKafkaResponse, errorCode: 1 }))
      )
    );
    const adapter = KA.create(producerMock);
    // When
    const publishedOrError = await adapter.publish(aDocument)();
    // Then
    expect(E.isLeft(publishedOrError)).toBeTruthy();
    expect(mockSendMessage).toHaveBeenCalledWith({
      messages: [{ value: JSON.stringify(aDocument) }],
      topic: aTopic
    });
  });
});
