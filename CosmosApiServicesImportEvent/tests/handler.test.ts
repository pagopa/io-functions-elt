import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import * as E from "fp-ts/Either";
import { Service } from "@pagopa/io-functions-commons/dist/src/models/service";
import { aService } from "../../__mocks__/services.mock";
import { importServices } from "../handler";

import { ServiceModel } from "@pagopa/io-functions-commons/dist/src/models/service";
import { forEach } from "lodash";

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
    ...aService,
    ...s
  })),
  t.array(Service).decode,
  E.getOrElseW(() => {
    throw Error();
  })
);

async function* buildServiceIterator(
  list: ReadonlyArray<unknown>
): AsyncGenerator<ReadonlyArray<t.Validation<Service>>, void, unknown> {
  // eslint-disable-next-line functional/no-let
  for (let index = 0; index < list.length; index += 2) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    index + 1 < list.length
      ? yield [Service.decode(list[index]), Service.decode(list[index])]
      : yield [Service.decode(list[index])];
  }
}

const serviceModelMock = {
  getCollectionIterator: jest.fn(() =>
    buildServiceIterator(aListOfRightServices)[Symbol.asyncIterator]()
  )
};

describe("CosmosApiServicesImportEvent", () => {
  it("sould send all services version to kafka client, ordered by serviceId and version", async () => {
    for await (const v of serviceModelMock.getCollectionIterator()) {
      console.log(v);
    }
  });
});
