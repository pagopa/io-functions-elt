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
import { Producer, ProducerRecord, RecordMetadata } from "kafkajs";
import { TableClient, TableInsertEntityHeaders } from "@azure/data-tables";
import { contramap } from "fp-ts/lib/Ord";
import { aRetrievedService } from "../../__mocks__/services.mock";
import { importServices } from "../handler";
import { KafkaProducerCompact } from "../../utils/kafka/KafkaProducerCompact";

const topic = "aTopic";

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

const producerMock = {
  connect: jest.fn(async () => void 0),
  disconnect: jest.fn(async () => void 0),
  send: jest.fn(async (pr: ProducerRecord) =>
    pipe(
      pr.messages,
      RA.map(
        __ =>
          ({
            errorCode: 0,
            partition: 1,
            topicName: pr.topic
          } as RecordMetadata)
      )
    )
  ),
  sendBatch: jest.fn(async _ => {
    [] as ReadonlyArray<RecordMetadata>;
  })
};

const kpc: KafkaProducerCompact<RetrievedService> = () => ({
  producer: (producerMock as unknown) as Producer,
  topic: { topic }
});

const createEntityMock = jest.fn(
  async (_entity, _options) => ({} as TableInsertEntityHeaders)
);
const tableClient: TableClient = ({
  createEntity: createEntityMock
} as unknown) as TableClient;

// ----------------------
// Tests
// ----------------------

describe("CosmosApiServicesImportEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sould send all services version to kafka client, ordered by serviceId and version", async () => {
    const res = await importServices(serviceModelMock, kpc, tableClient);

    expect(tableClient.createEntity).not.toHaveBeenCalled();
    expect(res).toEqual(
      expect.objectContaining({
        isSuccess: true,
        partitionKey: `${new Date().getMonth() + 1}`,
        result: "Documents sent (6). No decoding errors."
      })
    );

    const expected = pipe(
      aListOfOrderedServices,
      RA.map(m => ({
        value: JSON.stringify(m)
      })),
      RA.toArray
    );

    expect(producerMock.send).toHaveBeenCalledWith(
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

    const res = await importServices(serviceModelMock, kpc, tableClient);

    expect(tableClient.createEntity).toHaveBeenCalled();
    expect(res).toEqual(
      expect.objectContaining({
        isSuccess: false,
        partitionKey: `${new Date().getMonth() + 1}`,
        result:
          "Documents sent (6). Error decoding some documents. Check storage table errors for details."
      })
    );
  });

  it("should exit if unexpected eception during send occurred", async () => {
    producerMock.send.mockImplementationOnce(
      jest.fn(async (_pr: ProducerRecord) => {
        throw Error();
      })
    );

    const res = await importServices(serviceModelMock, kpc, tableClient);

    expect(tableClient.createEntity).toHaveBeenCalledTimes(
      aListOfRightServices.length
    );
    expect(res).toEqual(
      expect.objectContaining({
        isSuccess: false,
        partitionKey: `${new Date().getMonth() + 1}`,
        result:
          "Error publishing some documents. Check storage table errors for details. No decoding errors."
      })
    );
  });

  it("should exit if error sending at least one message occurred", async () => {
    producerMock.send.mockImplementationOnce(
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

    const res = await importServices(serviceModelMock, kpc, tableClient);

    expect(tableClient.createEntity).toHaveBeenCalledTimes(1);
    expect(res).toEqual(
      expect.objectContaining({
        isSuccess: false,
        partitionKey: `${new Date().getMonth() + 1}`,
        result:
          "Error publishing some documents. Check storage table errors for details. No decoding errors."
      })
    );
  });
});
