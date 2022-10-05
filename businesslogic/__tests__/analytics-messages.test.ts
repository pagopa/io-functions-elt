import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import { Producer, ProducerRecord } from "kafkajs";
import { QueueClient } from "@azure/storage-queue";
import * as KA from "../../outbound/adapter/kafka-outbound-publisher";
import * as QA from "../../outbound/adapter/queue-outbound-publisher";
import * as TA from "../../outbound/adapter/tracker-outbound-publisher";
import * as EA from "../../outbound/adapter/messages-outbound-enricher";
import { TelemetryClient } from "applicationinsights";
import {
  FiscalCode,
  NonEmptyString,
  OrganizationFiscalCode
} from "@pagopa/ts-commons/lib/strings";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { OutboundPublisher } from "../../outbound/port/outbound-publisher";
import { SeverityLevel } from "../../outbound/port/outbound-tracker";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { identity } from "lodash";
import { ValidationError } from "io-ts";
import {
  RetrievedService,
  toAuthorizedCIDRs
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { MaxAllowedPaymentAmount } from "@pagopa/io-functions-commons/dist/generated/definitions/MaxAllowedPaymentAmount";
import {
  MessageModel,
  NewMessageWithoutContent,
  RetrievedMessage,
  RetrievedMessageWithContent,
  RetrievedMessageWithoutContent
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { FeatureLevelTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/FeatureLevelType";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "@pagopa/io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";
import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";
import { MessageBodyMarkdown } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageBodyMarkdown";
import { MessageSubject } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageSubject";
import { getAnalyticsProcessorForMessages } from "../analytics-messages";

const aTopic = "a-topic";
const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aCosmosMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "xyz",
  _ts: 1
};
const aNewMessageWithoutContent: NewMessageWithoutContent = {
  createdAt: new Date(),
  featureLevelType: FeatureLevelTypeEnum.STANDARD,
  fiscalCode: aFiscalCode,
  id: "A_MESSAGE_ID" as NonEmptyString,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  isPending: true,
  kind: "INewMessageWithoutContent",
  senderServiceId: "test" as ServiceId,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};
const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;
const aMessageContent: MessageContent = {
  markdown: aMessageBodyMarkdown,
  subject: "test".repeat(10) as MessageSubject
};
const aRetrievedMessageWithoutContent: RetrievedMessageWithoutContent = pipe(
  {
    ...aNewMessageWithoutContent,
    ...aCosmosMetadata,
    isPending: false,
    kind: "IRetrievedMessageWithoutContent"
  },
  RetrievedMessageWithoutContent.decode,
  E.getOrElseW(e => {
    throw e;
  })
);
const aRetrievedMessageWithContent: RetrievedMessageWithContent = pipe(
  {
    ...aRetrievedMessageWithoutContent,
    content: aMessageContent,
    kind: "IRetrievedMessageWithContent"
  },
  RetrievedMessageWithContent.decode,
  E.getOrElseW(e => {
    throw e;
  })
);
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
  RetrievedMessage
>;
const fallbackAdapter = QA.create(mockQueueClient) as OutboundPublisher<
  RetrievedMessage
>;
const trackerAdapter = TA.create(trackerMock);
const mockGetContentFromBlob = jest
  .fn()
  .mockImplementation(() => TE.of(O.some(aMessageContent)));
const enrichAdapter = EA.create(
  {
    getContentFromBlob: mockGetContentFromBlob
  } as any,
  {} as any
);

describe("publish", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a valid list of not pending messages and a not working content enricher, WHEN processing the list, THEN send the message to the queue without publishing it on the topic", async () => {
    // Given
    mockGetContentFromBlob.mockImplementationOnce(() => TE.left(anError));
    const documents = [aRetrievedMessageWithoutContent];
    const processorAdapter = getAnalyticsProcessorForMessages(
      trackerAdapter,
      enrichAdapter,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(1);
    expect(mockSendMessageViaQueue).toHaveBeenNthCalledWith(
      1,
      Buffer.from(JSON.stringify(documents[0])).toString("base64")
    );
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(0);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of pending messages, WHEN processing the list, THEN publish it to the topic without enrichment", async () => {
    // Given
    const documents = [{ ...aRetrievedMessageWithoutContent, isPending: true }];
    const processorAdapter = getAnalyticsProcessorForMessages(
      trackerAdapter,
      enrichAdapter,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
    expect(mockSendMessageViaTopic).toHaveBeenNthCalledWith(1, {
      messages: [
        {
          value: JSON.stringify(documents[0])
        }
      ],
      topic: aTopic
    });
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(0);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of messages, WHEN processing the list, THEN publish it to the topic", async () => {
    // Given
    const documents = [
      aRetrievedMessageWithoutContent,
      { ...aRetrievedMessageWithoutContent, id: "another-id" }
    ];
    const processorAdapter = getAnalyticsProcessorForMessages(
      trackerAdapter,
      enrichAdapter,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(documents.length);
    pipe(
      documents,
      RA.mapWithIndex((i, document) =>
        expect(mockSendMessageViaTopic).toHaveBeenNthCalledWith(i + 1, {
          messages: [
            {
              value: JSON.stringify({
                ...document,
                content: aMessageContent,
                kind: "IRetrievedMessageWithContent"
              })
            }
          ],
          topic: aTopic
        })
      )
    );
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(0);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a not valid list of messages, WHEN processing the list, THEN track the exception", async () => {
    // Given
    const documents = [{ name: "1" }, { name: "2" }];
    const processorAdapter = getAnalyticsProcessorForMessages(
      trackerAdapter,
      enrichAdapter,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockTrackException).toHaveBeenCalledTimes(2);
    RA.mapWithIndex((i, document) =>
      expect(mockTrackException).toHaveBeenNthCalledWith(i + 1, {
        exception: pipe(
          document,
          RetrievedMessage.decode,
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

  it("GIVEN a valid list of messages and a Kafka Producer Client not working the first time, WHEN processing the list, THEN send one message to the topic and one message to the queue", async () => {
    // Given
    mockSendMessageViaTopic.mockImplementationOnce(async () => {
      throw anError;
    });
    const documents = [
      aRetrievedMessageWithoutContent,
      { ...aRetrievedMessageWithoutContent, id: "another-id" }
    ];
    const processorAdapter = getAnalyticsProcessorForMessages(
      trackerAdapter,
      enrichAdapter,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(1);
    expect(mockSendMessageViaQueue).toHaveBeenNthCalledWith(
      1,
      Buffer.from(JSON.stringify(documents[0])).toString("base64")
    );
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(2);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of messages and a not working Kafka Producer Client, WHEN processing the list, THEN send it to the queue", async () => {
    // Given
    mockSendMessageViaTopic.mockImplementation(async () => {
      throw anError;
    });
    const documents = [
      aRetrievedMessageWithoutContent,
      { ...aRetrievedMessageWithoutContent, id: "another-id" }
    ];
    const processorAdapter = getAnalyticsProcessorForMessages(
      trackerAdapter,
      enrichAdapter,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
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

  it("GIVEN a valid list of message status and both a not working Kafka Producer Client and a not working Queue Storage Client, WHEN processing the list, THEN throw an exception ", async () => {
    // Given
    mockSendMessageViaTopic.mockImplementation(async () => {
      throw anError;
    });
    mockSendMessageViaQueue.mockImplementation(async () => {
      throw anError;
    });
    const documents = [
      aRetrievedMessageWithoutContent,
      { ...aRetrievedMessageWithoutContent, id: "another-id" }
    ];
    const processorAdapter = getAnalyticsProcessorForMessages(
      trackerAdapter,
      enrichAdapter,
      mainAdapter,
      fallbackAdapter
    );
    // When
    const publishOrThrow = expect(processorAdapter.process(documents)());
    // Then
    await publishOrThrow.rejects.toThrow();
  });
});
