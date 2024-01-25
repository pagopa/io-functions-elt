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
import * as PF from "../../outbound/adapter/predicate-outbound-filterer";
import { TelemetryClient } from "applicationinsights";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { OutboundPublisher, success } from "../../outbound/port/outbound-publisher";
import { SeverityLevel } from "../../outbound/port/outbound-tracker";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { identity } from "lodash";
import { ValidationError } from "io-ts";
import {
  NewMessageWithoutContent,
  RetrievedMessage,
  RetrievedMessageWithoutContent
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { FeatureLevelTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/FeatureLevelType";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "@pagopa/io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";
import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";
import { MessageBodyMarkdown } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageBodyMarkdown";
import { MessageSubject } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageSubject";
import { getAnalyticsProcessorForDocuments } from "../analytics-publish-documents";
import { OutboundFilterer } from "../../outbound/port/outbound-filterer";
import { OutboundEnricher } from "../../outbound/port/outbound-enricher";
import * as T from "fp-ts/Task";
import {RetrievedMessageWithToken} from "../../utils/types/retrievedMessageWithToken"
import * as CAE from "../../outbound/adapter/combine-outbound-enricher";

const aToken = "a-token";
const aTopic = "a-topic";
const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aTestFiscalCode = "AAAAAA00A00A011T" as FiscalCode;
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
  {} as any,
  500
);

const mockPersonalDataVaultEnricher = () => {
  const mockEnrich = jest.fn(d => TE.right(d) as TE.TaskEither<Error, RetrievedMessageWithToken>);
  const mockEnrichs = jest.fn(ds => T.of(ds.map((d: any) => success({...d, token: aToken}))));
  return {
      mockEnrich,
      mockEnrichs,
      enricher: {
          enrich: mockEnrich,
          enrichs: mockEnrichs
      } as OutboundEnricher<RetrievedMessageWithToken>
  }
}

const aMessagePredicate = (retrievedMessage: RetrievedMessage) =>
  aTestFiscalCode !== retrievedMessage.fiscalCode;
const messageFilterer: OutboundFilterer<RetrievedMessage> = PF.create(
  aMessagePredicate
);

describe("publish", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a valid list of not pending messages and a not working content enricher, WHEN processing the list, THEN send the message to the queue without publishing it on the topic", async () => {
    // Given
    const mockPdv = mockPersonalDataVaultEnricher();
    const messageEnricherWithTokenAdapater = CAE.create(
      enrichAdapter,
      mockPdv.enricher
    );
    mockGetContentFromBlob.mockImplementationOnce(() => TE.left(anError));
    const documents = [aRetrievedMessageWithoutContent];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedMessageWithToken,
      trackerAdapter,
      messageEnricherWithTokenAdapater,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockPdv.mockEnrichs).toHaveBeenCalledTimes(1);
    expect(mockPdv.mockEnrichs).toHaveBeenCalledWith([]);
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
    const mockPdv = mockPersonalDataVaultEnricher();
    const messageEnricherWithTokenAdapater = CAE.create(
      enrichAdapter,
      mockPdv.enricher
    );
    const documents = [{ ...aRetrievedMessageWithoutContent, isPending: true }];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedMessage,
      trackerAdapter,
      messageEnricherWithTokenAdapater,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockPdv.mockEnrichs).toHaveBeenCalledTimes(1);
    expect(mockPdv.mockEnrichs).toHaveBeenCalledWith(documents);
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
    expect(mockSendMessageViaTopic).toHaveBeenNthCalledWith(1, {
      messages: [
        {
          value: JSON.stringify({...documents[0], token: aToken})
        }
      ],
      topic: aTopic
    });
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(0);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of messages, WHEN processing the list, THEN publish it to the topic", async () => {
    // Given
    const mockPdv = mockPersonalDataVaultEnricher();
    const messageEnricherWithTokenAdapater = CAE.create(
      enrichAdapter,
      mockPdv.enricher
    );
    const documents = [
      aRetrievedMessageWithoutContent,
      { ...aRetrievedMessageWithoutContent, id: "another-id" }
    ];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedMessage,
      trackerAdapter,
      messageEnricherWithTokenAdapater,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
    expect(mockSendMessageViaTopic).toHaveBeenCalledWith({
      messages: documents.map(document => ({
        value: JSON.stringify({
          ...document,
          content: aMessageContent,
          kind: "IRetrievedMessageWithContent",
          token: aToken,
        })
      })),
      topic: aTopic
    });
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(0);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of messages, WHEN processing the list, THEN publish only elements NOT related to Test Fiscal Codes to the topic", async () => {
    // Given
    const mockPdv = mockPersonalDataVaultEnricher();
    const messageEnricherWithTokenAdapater = CAE.create(
      enrichAdapter,
      mockPdv.enricher
    );
    const documents = [
      aRetrievedMessageWithoutContent,
      {
        ...aRetrievedMessageWithoutContent,
        id: "another-id" as NonEmptyString
      },
      { ...aRetrievedMessageWithoutContent, fiscalCode: aTestFiscalCode }
    ];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedMessage,
      trackerAdapter,
      messageEnricherWithTokenAdapater,
      mainAdapter,
      fallbackAdapter,
      messageFilterer
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
    expect(mockSendMessageViaTopic).toHaveBeenCalledWith({
      messages: documents.filter(aMessagePredicate).map(document => ({
        value: JSON.stringify({
          ...document,
          content: aMessageContent,
          kind: "IRetrievedMessageWithContent",
          token: aToken,
        })
      })),
      topic: aTopic
    });
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(0);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a not valid list of messages, WHEN processing the list, THEN track the exception", async () => {
    // Given
    const documents = [{ name: "1" }, { name: "2" }];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedMessage,
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

  it("GIVEN a valid list of over 500 messages and a Kafka Producer Client not working the first time, WHEN processing the list, THEN send only the first 500 (batch size) messages to the queue", async () => {
    // Given
    const mockPdv = mockPersonalDataVaultEnricher();
    const messageEnricherWithTokenAdapater = CAE.create(
      enrichAdapter,
      mockPdv.enricher
    );
    // publish is called in parallel so we check the id of the first value to esure a throw with the first chunk
    mockSendMessageViaTopic.mockImplementation(async i => {
      if (JSON.parse(i.messages[0].value as any).id === "another-id_0") {
        throw anError;
      } else
        return pipe(
          i.messages,
          RA.map(() => aKafkaResponse)
        );
    });
    const documents = RA.makeBy(1000, i => ({
      ...aRetrievedMessageWithoutContent,
      id: `another-id_${i}`
    }));
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedMessage,
      trackerAdapter,
      messageEnricherWithTokenAdapater,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(500);
    pipe(
      documents.slice(0, 500),
      RA.mapWithIndex((i, document) =>
        expect(mockSendMessageViaQueue).toHaveBeenNthCalledWith(
          i + 1,
          Buffer.from(
            JSON.stringify({
              ...document,
              content: aMessageContent,
              kind: "IRetrievedMessageWithContent",
              token: aToken
            })
          ).toString("base64")
        )
      )
    );
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(2);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of messages and a not working Kafka Producer Client, WHEN processing the list, THEN send it to the queue", async () => {
    // Given
    const mockPdv = mockPersonalDataVaultEnricher();
    const messageEnricherWithTokenAdapater = CAE.create(
      enrichAdapter,
      mockPdv.enricher
    );
    mockSendMessageViaTopic.mockImplementation(async () => {
      throw anError;
    });
    const documents = [
      aRetrievedMessageWithoutContent,
      { ...aRetrievedMessageWithoutContent, id: "another-id" }
    ];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedMessage,
      trackerAdapter,
      messageEnricherWithTokenAdapater,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(2);
    pipe(
      documents,
      RA.mapWithIndex((i, document) =>
        expect(mockSendMessageViaQueue).toHaveBeenNthCalledWith(
          i + 1,
          Buffer.from(
            JSON.stringify({
              ...document,
              content: aMessageContent,
              kind: "IRetrievedMessageWithContent",
              token: aToken
            })
          ).toString("base64")
        )
      )
    );
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of message status and both a not working Kafka Producer Client and a not working Queue Storage Client, WHEN processing the list, THEN throw an exception ", async () => {
    // Given
    const mockPdv = mockPersonalDataVaultEnricher();
    const messageEnricherWithTokenAdapater = CAE.create(
      enrichAdapter,
      mockPdv.enricher
    );
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
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedMessage,
      trackerAdapter,
      messageEnricherWithTokenAdapater,
      mainAdapter,
      fallbackAdapter
    );
    // When
    const publishOrThrow = expect(processorAdapter.process(documents)());
    // Then
    await publishOrThrow.rejects.toThrow();
  });
});
