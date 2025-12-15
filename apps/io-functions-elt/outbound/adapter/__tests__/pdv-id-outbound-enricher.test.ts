import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { TelemetryClient } from "applicationinsights";
import { Client } from "../../../generated/pdv-tokenizer-api/client";
import { create, MaybePdvDocumentsTypes } from "../pdv-id-outbound-enricher";
import * as E from "fp-ts/lib/Either";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { Errors } from "io-ts";
import { Result } from "../../port/outbound-publisher";
import {
  aMockPdvId,
  aRetrievedProfile,
  aRetrievedProfileList,
  aRetrievedServicePreferences,
  aRetrievedServicePreferencesList
} from "../../../businesslogic/__mocks__/data.mock";
import { RedisClientType } from "redis";
import * as TE from "fp-ts/lib/TaskEither";
import { Second } from "@pagopa/ts-commons/lib/units";
import { PDVIdPrefix } from "../../../utils/redis";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSave = vi
  .fn()
  .mockImplementation(_ =>
    Promise.resolve(E.right({ status: 200, value: { token: aMockPdvId } }))
  );
const mockTrackEvent = vi.fn();
const mockTelemetryClient = ({
  trackEvent: mockTrackEvent
} as unknown) as TelemetryClient;
const mockTokenizerClient = ({
  saveUsingPUT: mockSave
} as unknown) as Client;

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

const enricher = create(
  2,
  mockTokenizerClient,
  TE.right(mockRedisClient),
  mockPDVIdsTTL,
  mockTelemetryClient
);

describe.each`
  title                        | value                               | isList   | length
  ${"profile"}                 | ${aRetrievedProfile}                | ${false} | ${1}
  ${"profile list"}            | ${aRetrievedProfileList}            | ${true}  | ${2}
  ${"service preference"}      | ${aRetrievedServicePreferences}     | ${false} | ${1}
  ${"service preference list"} | ${aRetrievedServicePreferencesList} | ${true}  | ${2}
`("$title enricher", ({ value, isList, length }) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const call = isList ? enricher.enrichs(value) : enricher.enrich(value);

  const expectSuccess = (
    result:
      | readonly Result<MaybePdvDocumentsTypes>[]
      | E.Either<Error, MaybePdvDocumentsTypes>
  ) => {
    if (isList) {
      expect(result).toMatchObject([
        { success: true, document: { ...value[0], userPDVId: aMockPdvId } },
        { success: true, document: { ...value[1], userPDVId: aMockPdvId } }
      ]);
    } else {
      expect(result).toStrictEqual(
        E.right({
          ...value,
          userPDVId: aMockPdvId
        })
      );
    }
    expect(mockTrackEvent).not.toHaveBeenCalled();
  };

  const setupFail = (impl: (...args: any) => any) => {
    for (let i = 0; i < length; i++) {
      mockSave.mockImplementationOnce(impl);
    }
  };
  const expectFail = (
    result:
      | readonly Result<MaybePdvDocumentsTypes>[]
      | E.Either<Error, MaybePdvDocumentsTypes>,
    error: Error
  ) => {
    if (isList) {
      expect(result).toMatchObject([
        { success: false, error },
        { success: false, error }
      ]);
      expect(mockTrackEvent).toHaveBeenCalledTimes(length);
    } else {
      expect(result).toStrictEqual(E.left(error));
      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    }
  };

  it("GIVEN a valid document, WHEN enriching a single message THEN retrieve a valid PDVid", async () => {
    const result = await call();
    expectSuccess(result);
  });

  it("GIVEN a valid document, WHEN the client can not decode the response THEN a fail is expected", async () => {
    const error = (NonEmptyString.decode("") as E.Left<Errors>).left;
    setupFail(() => Promise.resolve(E.left(error)));
    const result = await call();
    expectFail(result, Error(readableReportSimplified(error)));
  });

  it("GIVEN a valid document, WHEN PDV can not be contacted THEN a fail is expected", async () => {
    setupFail(() => Promise.reject("network error"));
    const result = await call();
    expectFail(result, Error("network error"));
  });

  it.each`
    status
    ${400}
    ${403}
    ${429}
    ${500}
  `(
    "GIVEN a valid document, WHEN PDV response is an error $status THEN a fail is expected",
    async ({ status }) => {
      setupFail(() =>
        Promise.resolve(E.right({ status, value: { title: "error" } }))
      );
      const result = await call();
      expectFail(
        result,
        Error(`Pdv tokenizer returned ${status} with error: error`)
      );
    }
  );

  it("GIVEN a valid document, WHEN PDV has an unexpected response THEN a decode error should happen", async () => {
    const error = (NonEmptyString.decode("") as E.Left<Errors>).left;
    setupFail(() =>
      Promise.resolve(E.right({ status: 200, value: { token: "" } }))
    );
    const result = await call();
    expectFail(
      result,
      Error(
        `Unexpected empty token from tokenizer: ${readableReportSimplified(
          error
        )}`
      )
    );
  });
});

describe("Redis cache introduction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const call = enricher.enrich(aRetrievedProfile);

  it("GIVEN a valid document WHEN the cache already has the token THEN PDV Tokenizer should not be called", async () => {
    mockGet.mockResolvedValueOnce(aMockPdvId);

    const result = await call();
    expect(result).toStrictEqual(
      E.right({
        ...aRetrievedProfile,
        userPDVId: aMockPdvId
      })
    );
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("GIVEN a valid document WHEN the cache doesn't hold the token THEN PDV Tokenizer should be called along with the cache", async () => {
    mockGet.mockResolvedValueOnce(undefined);

    const result = await call();
    expect(result).toStrictEqual(
      E.right({
        ...aRetrievedProfile,
        userPDVId: aMockPdvId
      })
    );
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      `${PDVIdPrefix}${aRetrievedProfile.fiscalCode}`,
      mockPDVIdsTTL,
      aMockPdvId
    );
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("GIVEN a valid document WHEN the cache get goes wrong THEN PDV Tokenizer should be called along with the cache", async () => {
    mockGet.mockRejectedValueOnce(Error("error"));

    const result = await call();
    expect(result).toStrictEqual(
      E.right({
        ...aRetrievedProfile,
        userPDVId: aMockPdvId
      })
    );
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      `${PDVIdPrefix}${aRetrievedProfile.fiscalCode}`,
      mockPDVIdsTTL,
      aMockPdvId
    );
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });

  it("GIVEN a valid document WHEN the cache can't be reached THEN PDV Tokenizer should be called", async () => {
    const faultyEnricher = create(
      2,
      mockTokenizerClient,
      TE.left(Error("error")),
      mockPDVIdsTTL,
      mockTelemetryClient
    );
    const result = await faultyEnricher.enrich(aRetrievedProfile)();
    expect(result).toStrictEqual(
      E.right({
        ...aRetrievedProfile,
        userPDVId: aMockPdvId
      })
    );
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });

  it("GIVEN a valid document WHEN the cache can't be reached to save the token THEN we go ahead", async () => {
    mockSet.mockRejectedValueOnce(Error("error"));

    const result = await call();

    expect(result).toStrictEqual(
      E.right({
        ...aRetrievedProfile,
        userPDVId: aMockPdvId
      })
    );
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      `${PDVIdPrefix}${aRetrievedProfile.fiscalCode}`,
      mockPDVIdsTTL,
      aMockPdvId
    );
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });
});
