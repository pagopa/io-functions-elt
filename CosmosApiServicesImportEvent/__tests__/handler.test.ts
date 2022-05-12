import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import * as E from "fp-ts/Either";
import * as RA from "fp-ts/ReadonlyArray";
import * as S from "fp-ts/string";
import * as N from "fp-ts/number";
import {
  RetrievedService,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { ProducerRecord, RecordMetadata } from "kafkajs";
import { contramap } from "fp-ts/lib/Ord";
import { aRetrievedService } from "../../__mocks__/services.mock";
import { importServices } from "../handler.services";
import { QueueClient } from "@azure/storage-queue";
import { TelemetryClient } from "../../utils/appinsights";
import { mockProducerCompact } from "../../utils/kafka/__mocks__/KafkaProducerCompact";

type ServiceIDAndVersion = t.TypeOf<typeof ServiceIDAndVersion>;
const ServiceIDAndVersion = t.interface({
  serviceId: NonEmptyString,
  version: NonNegativeInteger
});

const aListOfServiceIdsAndVersions = pipe(
  [
    { serviceId: "s-124", version: 0 },
    { serviceId: "s-321", version: 1 },
    { serviceId: "s-124", version: 1 },
    { serviceId: "s-321", version: 0 },
    { serviceId: "s-124", version: 2 },
    { serviceId: "s-321", version: 2 }
  ],
  t.array(ServiceIDAndVersion).decode,
  E.getOrElseW(() => {
    throw Error();
  })
);

const aListOfRightServices = pipe(
  aListOfServiceIdsAndVersions.map(s => ({
    ...aRetrievedService,
    ...s
  })),
  t.array(RetrievedService).decode,
  E.getOrElseW(() => {
    throw Error();
  })
);
const aListOfServicesWithDecodingError = [
  ...aListOfRightServices,
  { serviceId: "anId" }
];

// eslint-disable-next-line functional/immutable-data
const aListOfOrderedServices = pipe(
  aListOfRightServices,
  RA.sortBy([
    contramap((p: RetrievedService) => p.serviceId)(S.Ord),
    contramap((p: RetrievedService) => p.version)(N.Ord)
  ]),
  RA.toArray
);

async function* buildServiceIterator(
  list: ReadonlyArray<unknown>
): AsyncGenerator<
  ReadonlyArray<t.Validation<RetrievedService>>,
  void,
  unknown
> {
  // eslint-disable-next-line functional/no-let

  for (const p of pipe(list, RA.map(RetrievedService.decode), RA.chunksOf(2))) {
    yield p;
  }
}

// ----------------------
// Mocks
// ----------------------
const collectionIteratorMock = jest.fn(() =>
  buildServiceIterator(aListOfRightServices)[Symbol.asyncIterator]()
);

const serviceModelMock = ({
  getCollectionIterator: collectionIteratorMock
} as unknown) as ServiceModel;

const dummyProducerCompact = mockProducerCompact(aRetrievedService);

const mockQueueClient = ({
  sendMessage: jest.fn(() => Promise.resolve())
} as unknown) as QueueClient;

const mockTelemetryClient = ({
  trackException: jest.fn(_ => void 0)
} as unknown) as TelemetryClient;

// ----------------------
// Tests
// ----------------------

describe("CosmosApiServicesImportEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sould send all services version to kafka client, ordered by serviceId and version", async () => {
    const res = await importServices(
      serviceModelMock,
      dummyProducerCompact.getClient,
      mockQueueClient,
      mockTelemetryClient
    );

    expect(mockQueueClient.sendMessage).not.toHaveBeenCalled();
    expect(res).toEqual(
      expect.objectContaining({
        isSuccess: true
      })
    );

    const expected = pipe(
      aListOfOrderedServices,
      RA.map(m => ({
        value: JSON.stringify(m)
      })),
      RA.toArray
    );

    expect(dummyProducerCompact.producer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining(expected)
      })
    );
  });

  it("should exit if decoding error was found", async () => {
    collectionIteratorMock.mockReturnValueOnce(
      buildServiceIterator(aListOfServicesWithDecodingError)[
        Symbol.asyncIterator
      ]()
    );

    const res = await importServices(
      serviceModelMock,
      dummyProducerCompact.getClient,
      mockQueueClient,
      mockTelemetryClient
    );

    expect(mockQueueClient.sendMessage).not.toHaveBeenCalled();
    expect(res).toEqual(
      expect.objectContaining({
        isSuccess: false
      })
    );
  });

  it("should exit if unexpected eception during send occurred", async () => {
    dummyProducerCompact.producer.send.mockImplementationOnce(
      jest.fn(async (_pr: ProducerRecord) => {
        throw Error();
      })
    );

    const res = await importServices(
      serviceModelMock,
      dummyProducerCompact.getClient,
      mockQueueClient,
      mockTelemetryClient
    );

    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(
      aListOfRightServices.length
    );
    expect(res).toEqual(
      expect.objectContaining({
        isSuccess: false
      })
    );
  });

  it("should exit if error sending at least one message occurred", async () => {
    dummyProducerCompact.producer.send.mockImplementationOnce(
      jest.fn(async (pr: ProducerRecord) =>
        pipe(
          pr.messages,
          RA.mapWithIndex(
            (i, __) =>
              ({
                // Set errorCode != 0
                errorCode: i === 0 ? 1 : 0,
                partition: 1,
                topicName: pr.topic
              } as RecordMetadata)
          )
        )
      )
    );

    const res = await importServices(
      serviceModelMock,
      dummyProducerCompact.getClient,
      mockQueueClient,
      mockTelemetryClient
    );

    expect(mockQueueClient.sendMessage).toHaveBeenCalledTimes(0);
    expect(res).toEqual(
      expect.objectContaining({
        isSuccess: false
      })
    );
  });
});
