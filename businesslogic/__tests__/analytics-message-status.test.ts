import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/Either";
import { getAnalyticsProcessForMessageStatus } from "../analytics-message-status";
import { Producer, ProducerRecord } from "kafkajs";
import { QueueClient } from "@azure/storage-queue";
import * as KA from "../../outbound/adapter/kafka-outbound-publisher";
import * as QA from "../../outbound/adapter/queue-outbound-publisher";
import * as TA from "../../outbound/adapter/tracker-outbound-publisher";
import { TelemetryClient } from "applicationinsights";
import {
  MessageStatus,
  RetrievedMessageStatus
} from "@pagopa/io-functions-commons/dist/src/models/message_status";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { MessageStatusValueEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageStatusValue";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { OutboundPublisher } from "../../outbound/port/outbound-publisher";
import { SeverityLevel } from "../../outbound/port/outbound-tracker";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { identity } from "lodash";
import { ValidationError } from "io-ts";

const aTopic = "a-topic";
const aMessageId = "A_MESSAGE_ID" as NonEmptyString;
const aMessageStatus: MessageStatus = {
  messageId: aMessageId,
  status: MessageStatusValueEnum.ACCEPTED,
  updatedAt: new Date("2022-09-29T15:41:34.826Z"),
  isRead: false,
  isArchived: false
};
const aCosmosMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "xyz",
  _ts: 1
};
const aRetrievedMessageStatus: RetrievedMessageStatus = {
  ...aCosmosMetadata,
  ...aMessageStatus,
  id: aMessageStatus.messageId,
  version: 1 as NonNegativeInteger,
  kind: "IRetrievedMessageStatus"
};
const anError = new Error("An error");
const aKafkaResponse = {
  errorCode: 0,
  partition: 1,
  topicName: aTopic
};

const mockSendMessageViaQueue = jest.fn(() => Promise.resolve());
const mockQueueClient = ({
  sendMessage: mockSendMessageViaQueue
} as unknown) as QueueClient;

const mockSendMessageViaTopic = jest.fn(async (pr: ProducerRecord) =>
  pipe(
    pr.messages,
    RA.map(() => aKafkaResponse)
  )
);
const producerMock = () => ({
  producer: ({
    connect: jest.fn(async () => void 0),
    disconnect: jest.fn(async () => void 0),
    send: mockSendMessageViaTopic
  } as unknown) as Producer,
  topic: { topic: aTopic }
});

const mockTrackException = jest.fn(_ => void 0);
const trackerMock = ({
  trackException: mockTrackException
} as unknown) as TelemetryClient;

const mainAdapter = KA.create(producerMock) as OutboundPublisher<
  RetrievedMessageStatus
>;
const fallbackAdapter = QA.create(mockQueueClient) as OutboundPublisher<
  RetrievedMessageStatus
>;
const trackerAdapter = TA.create(trackerMock);

describe("publish", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a valid list of message status, WHEN processing the list, THEN publish it to the topic", async () => {
    // Given
    const documents = [
      aRetrievedMessageStatus,
      { ...aRetrievedMessageStatus, version: 2 }
    ];
    const processAdapter = getAnalyticsProcessForMessageStatus(
      trackerAdapter,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(2);
    RA.mapWithIndex((i, document) =>
      expect(mockSendMessageViaTopic).toHaveBeenNthCalledWith(i + 1, {
        messages: [{ value: JSON.stringify(document) }],
        topic: aTopic
      })
    )(documents);
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(0);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a not valid list of message status, WHEN processing the list, THEN track the exception", async () => {
    // Given
    const documents = [{ name: "1" }, { name: "2" }];
    const processAdapter = getAnalyticsProcessForMessageStatus(
      trackerAdapter,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processAdapter.process(documents)();
    // Then
    expect(mockTrackException).toHaveBeenCalledTimes(2);
    RA.mapWithIndex((i, document) =>
      expect(mockTrackException).toHaveBeenNthCalledWith(i + 1, {
        exception: pipe(
          document,
          RetrievedMessageStatus.decode,
          E.fold(identity, () => {
            throw new Error("You should not be here!");
          }),
          e => (e as unknown) as ValidationError[],
          readableReport,
          message => new Error(message)
        ),
        severity: SeverityLevel.Error
      })
    )(documents);
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(0);
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of message status and a Kafka Producer Client not working the first time, WHEN processing the list, THEN send one message to the topic and one message to the queue", async () => {
    // Given
    mockSendMessageViaTopic.mockImplementationOnce(async () => {
      throw anError;
    });
    const documents = [
      aRetrievedMessageStatus,
      { ...aRetrievedMessageStatus, version: 2 }
    ];
    const processAdapter = getAnalyticsProcessForMessageStatus(
      trackerAdapter,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(1);
    expect(mockSendMessageViaQueue).toHaveBeenNthCalledWith(
      1,
      Buffer.from(JSON.stringify(documents[0])).toString("base64")
    );
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(2);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of message status and a not working Kafka Producer Client, WHEN processing the list, THEN send it to the queue", async () => {
    // Given
    mockSendMessageViaTopic.mockImplementation(async () => {
      throw anError;
    });
    const documents = [
      aRetrievedMessageStatus,
      { ...aRetrievedMessageStatus, version: 2 }
    ];
    const processAdapter = getAnalyticsProcessForMessageStatus(
      trackerAdapter,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(2);
    RA.mapWithIndex((i, document) =>
      expect(mockSendMessageViaQueue).toHaveBeenNthCalledWith(
        i + 1,
        Buffer.from(JSON.stringify(document)).toString("base64")
      )
    )(documents);
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(2);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });
});

it("GIVEN a valid list of message status and both a not working Kafka Producer Client and a not working Queue Storage Client, WHEN processing the list, THEN throw an exception ", async () => {
  // Given
  mockSendMessageViaTopic.mockImplementation(async () => {
    throw anError;
  });
  mockSendMessageViaQueue.mockImplementation(async () => {
    throw anError;
  });
  const documents = [
    aRetrievedMessageStatus,
    { ...aRetrievedMessageStatus, version: 2 }
  ];
  const processAdapter = getAnalyticsProcessForMessageStatus(
    trackerAdapter,
    mainAdapter,
    fallbackAdapter
  );
  // When
  const publishOrThrow = expect(processAdapter.process(documents)());
  // Then
  await publishOrThrow.rejects.toThrow();
});
