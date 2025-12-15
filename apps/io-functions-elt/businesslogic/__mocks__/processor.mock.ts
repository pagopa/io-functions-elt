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
import { aKafkaResponse, aMockPdvId, aTopic } from "./data.mock";
import { RedisClientType } from "redis";
import * as TE from "fp-ts/lib/TaskEither";
import { Second } from "@pagopa/ts-commons/lib/units";
import { vi } from "vitest";

// Mocks
export const mockTrackException = vi.fn(_ => void 0);
export const trackerMock = ({
  trackException: mockTrackException
} as unknown) as TelemetryClient;

export const mockSendMessageViaQueue = vi.fn(() => Promise.resolve());
export const mockQueueClient = ({
  sendMessage: mockSendMessageViaQueue
} as unknown) as QueueClient;

export const mockSendMessageViaTopic = vi.fn(async (pr: ProducerRecord) =>
  pipe(
    pr.messages,
    RA.map(() => aKafkaResponse)
  )
);
export const producerMock = () => ({
  producer: ({
    connect: vi.fn(async () => void 0),
    disconnect: vi.fn(async () => void 0),
    send: mockSendMessageViaTopic
  } as unknown) as Producer,
  topic: { topic: aTopic }
});

// Redis mock
const mockSet = vi.fn().mockResolvedValue("OK");
// DEFAULT BEHAVIOUR: redis doesn't contain the value in the cache
const mockGet = vi.fn().mockResolvedValue(undefined);
const mockRedisClient = ({
  set: mockSet,
  setEx: mockSet,
  get: mockGet
} as unknown) as RedisClientType;

const mockPDVIdsTTL = 30 as Second;
//

export const mockGetPdvId = vi
  .spyOn(pdv, "getPdvId")
  .mockReturnValue(RTE.right(aMockPdvId));

export const trackerAdapter = TA.create(trackerMock);

export const getPdvIdEnricherAdapter = <
  T extends PDVA.MaybePdvDocumentsTypes
>() =>
  PDVA.create<T>(
    10,
    ({} as unknown) as Client /* functionality mocked by mockGetPdvId */,
    TE.right(mockRedisClient),
    mockPDVIdsTTL,
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
