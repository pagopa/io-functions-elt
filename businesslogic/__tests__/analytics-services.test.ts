import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/Either";
import { Producer, ProducerRecord } from "kafkajs";
import { QueueClient } from "@azure/storage-queue";
import * as KA from "../../outbound/adapter/kafka-outbound-publisher";
import * as QA from "../../outbound/adapter/queue-outbound-publisher";
import * as TA from "../../outbound/adapter/tracker-outbound-publisher";
import * as EEA from "../../outbound/adapter/empty-outbound-enricher";
import { TelemetryClient } from "applicationinsights";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "@pagopa/ts-commons/lib/strings";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { OutboundPublisher } from "../../outbound/port/outbound-publisher";
import { SeverityLevel } from "../../outbound/port/outbound-tracker";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { identity } from "lodash";
import { ValidationError } from "io-ts";
import { getAnalyticsProcessorForDocuments } from "../analytics-publish-documents";
import {
  RetrievedService,
  toAuthorizedCIDRs
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { MaxAllowedPaymentAmount } from "@pagopa/io-functions-commons/dist/generated/definitions/MaxAllowedPaymentAmount";
import { OutboundEnricher } from "../../outbound/port/outbound-enricher";

const aTopic = "a-topic";
const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;
const aServiceId = "s123" as NonEmptyString;
const aService = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: new Set([]),
  departmentName: "IT" as NonEmptyString,
  isVisible: true,
  maxAllowedPaymentAmount: 0 as MaxAllowedPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "AgID" as NonEmptyString,
  requireSecureChannels: false,
  serviceId: aServiceId,
  serviceName: "Test" as NonEmptyString,
  version: 1 as NonNegativeInteger
};
const aCosmosMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "xyz",
  _ts: 1
};
const aRetrievedService: RetrievedService = pipe(
  {
    ...aCosmosMetadata,
    ...aService,
    id: aService.serviceId,
    kind: "IRetrievedService"
  },
  RetrievedService.decode,
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
  RetrievedService
>;
const fallbackAdapter = QA.create(mockQueueClient) as OutboundPublisher<
  RetrievedService
>;
const trackerAdapter = TA.create(trackerMock);
const emptyEnricher: OutboundEnricher<RetrievedService> = EEA.create();

describe("publish", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a valid list of services, WHEN processing the list, THEN publish it to the topic", async () => {
    // Given
    const documents = [aRetrievedService, { ...aRetrievedService, version: 2 }];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedService,
      trackerAdapter,
      emptyEnricher,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
    expect(mockSendMessageViaTopic).toHaveBeenCalledWith({
      messages: documents.map(document => ({
        value: JSON.stringify(document)
      })),
      topic: aTopic
    });
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(0);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a not valid list of services, WHEN processing the list, THEN track the exception", async () => {
    // Given
    const documents = [{ name: "1" }, { name: "2" }];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedService,
      trackerAdapter,
      emptyEnricher,
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
          RetrievedService.decode,
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

  it("GIVEN a valid list of over 500 services and a Kafka Producer Client not working the first time, WHEN processing the list, THEN send only the first 500 (batch size) services to the queue", async () => {
    // Given
    // publish is called in parallel so we check the version of the first value to esure a throw with the first chunk
    mockSendMessageViaTopic.mockImplementation(async i => {
      if (JSON.parse(i.messages[0].value as any).version === 1) {
        throw anError;
      } else
        return pipe(
          i.messages,
          RA.map(() => aKafkaResponse)
        );
    });
    const documents = RA.makeBy(1000, i => ({
      ...aRetrievedService,
      version: i + 1
    }));
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedService,
      trackerAdapter,
      emptyEnricher,
      mainAdapter,
      fallbackAdapter
    );
    // When
    await processorAdapter.process(documents)();
    // Then
    expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(500);
    RA.mapWithIndex((i, document) =>
      expect(mockSendMessageViaQueue).toHaveBeenNthCalledWith(
        i + 1,
        Buffer.from(JSON.stringify(document)).toString("base64")
      )
    )(documents.slice(0, 500));
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(2);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of services and a not working Kafka Producer Client, WHEN processing the list, THEN send it to the queue", async () => {
    // Given
    mockSendMessageViaTopic.mockImplementation(async () => {
      throw anError;
    });
    const documents = [aRetrievedService, { ...aRetrievedService, version: 2 }];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedService,
      trackerAdapter,
      emptyEnricher,
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
    expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
    expect(mockTrackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid list of services and both a not working Kafka Producer Client and a not working Queue Storage Client, WHEN processing the list, THEN throw an exception ", async () => {
    // Given
    mockSendMessageViaTopic.mockImplementation(async () => {
      throw anError;
    });
    mockSendMessageViaQueue.mockImplementation(async () => {
      throw anError;
    });
    const documents = [aRetrievedService, { ...aRetrievedService, version: 2 }];
    const processorAdapter = getAnalyticsProcessorForDocuments(
      RetrievedService,
      trackerAdapter,
      emptyEnricher,
      mainAdapter,
      fallbackAdapter
    );
    // When
    const publishOrThrow = expect(processorAdapter.process(documents)());
    // Then
    await publishOrThrow.rejects.toThrow();
  });
});
