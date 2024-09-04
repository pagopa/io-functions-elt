import { QueueClient } from "@azure/storage-queue";
import { TelemetryClient } from "applicationinsights";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { Producer, ProducerRecord } from "kafkajs";
import * as KA from "../../outbound/adapter/kafka-outbound-publisher";
import * as QAF from "../../outbound/adapter/queue-outbound-mapper-publisher";
import * as TA from "../../outbound/adapter/tracker-outbound-publisher";
import * as PDVA from "../../outbound/adapter/pdv-id-outbound-enricher";
import { OutboundPublisher } from "../../outbound/port/outbound-publisher";
import * as pdv from "../../utils/pdv";
import { Client } from "../../generated/pdv-tokenizer-api/client";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

export const aTopic = "a-topic";
export const anError = new Error("An error");

export const aCosmosMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "xyz",
  _ts: 1
};

// Mocks
export const mockTrackException = jest.fn(_ => void 0);
export const trackerMock = ({
  trackException: mockTrackException
} as unknown) as TelemetryClient;

export const mockSendMessageViaQueue = jest.fn(() => Promise.resolve());
export const mockQueueClient = ({
  sendMessage: mockSendMessageViaQueue
} as unknown) as QueueClient;

export const aKafkaResponse = {
  errorCode: 0,
  partition: 1,
  topicName: aTopic
};
export const mockSendMessageViaTopic = jest.fn(async (pr: ProducerRecord) =>
  pipe(
    pr.messages,
    RA.map(() => aKafkaResponse)
  )
);
export const producerMock = () => ({
  producer: ({
    connect: jest.fn(async () => void 0),
    disconnect: jest.fn(async () => void 0),
    send: mockSendMessageViaTopic
  } as unknown) as Producer,
  topic: { topic: aTopic }
});

export const aMockPdvId = "7f95058c-0cf4-400b-9b77-2cd18eaba0b0" as NonEmptyString;

export const mockGetPdvId = jest
  .spyOn(pdv, "getPdvId")
  .mockReturnValue(RTE.right(aMockPdvId));

export const trackerAdapter = TA.create(trackerMock);

export const getPdvIdEnricherAdapter = <
  T extends PDVA.MaybePdvDocumentsTypes
>() =>
  PDVA.create<T>(
    10,
    ({} as unknown) as Client /* functionality mocked by mockGetPdvId */,
    trackerMock
  );

export const getMainAdapter = <T extends PDVA.MaybePdvDocumentsTypes>() =>
  KA.create(producerMock) as OutboundPublisher<T>;

export const getFallbackAdapterWithFilter = <
  T extends PDVA.MaybePdvDocumentsTypes
>() =>
  QAF.create(docWithPDVId => {
    const { userPDVId, ...rest } = docWithPDVId;
    return rest;
  }, mockQueueClient) as OutboundPublisher<T>;
