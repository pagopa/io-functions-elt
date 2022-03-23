import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { FiscalCode } from "@pagopa/io-functions-commons/dist/generated/definitions/FiscalCode";
import { Container, OperationResponse } from "@azure/cosmos";
import { patchAllVersion } from "../handler";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { NewMessageWithoutContent } from "@pagopa/io-functions-commons/dist/src/models/message";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "@pagopa/io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";
import * as HANDLE from "../handler";

const mockBulk = jest.fn();
const mockContainer = ({
  items: {
    bulk: mockBulk
  }
} as unknown) as Container;

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aDummyId = "dummy-message-id" as NonEmptyString;

describe("patchAllVersion", () => {
  it("GIVEN an existing fiscalCode+id and a single patch response WHEN patch all version THEN return a successfull either", async () => {
    mockBulk.mockImplementationOnce(() =>
      Promise.resolve([{ statusCode: 200 }] as OperationResponse[])
    );
    const result = await patchAllVersion(mockContainer)({
      fiscalCode: aFiscalCode,
      id: aDummyId
    })();
    expect(E.isRight(result)).toBeTruthy();
    expect(mockBulk).toMatchSnapshot();
  });

  it("GIVEN an existing fiscalCode+id and a multiple patch response WHEN patch all version THEN return a successfull either", async () => {
    mockBulk.mockImplementationOnce(() =>
      Promise.resolve([
        { statusCode: 200 },
        { statusCode: 404 },
        { statusCode: 424 }
      ] as OperationResponse[])
    );
    const result = await patchAllVersion(mockContainer)({
      fiscalCode: aFiscalCode,
      id: aDummyId
    })();
    expect(E.isRight(result)).toBeTruthy();
    expect(mockBulk).toMatchSnapshot();
  });

  it("GIVEN an existing fiscalCode+id and am error patch response WHEN patch all version THEN return a failed either", async () => {
    mockBulk.mockImplementationOnce(() =>
      Promise.resolve([
        { statusCode: 200 },
        { statusCode: 200 },
        { statusCode: 500 }
      ] as OperationResponse[])
    );
    const result = await patchAllVersion(mockContainer)({
      fiscalCode: aFiscalCode,
      id: aDummyId
    })();
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left).toEqual({
        error: {
          message: "Error patching document [200,200,500]",
          name: "Patching Error"
        },
        kind: "COSMOS_ERROR_RESPONSE"
      });
    }
    expect(mockBulk).toMatchSnapshot();
  });
});

const cosmosMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};
const aSerializedNewMessageWithoutContent = {
  createdAt: new Date().toISOString(),
  fiscalCode: aFiscalCode,
  id: "A_MESSAGE_ID" as NonEmptyString,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  senderServiceId: "agid" as ServiceId,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};
const aNewMessageWithoutContent: NewMessageWithoutContent = {
  ...aSerializedNewMessageWithoutContent,
  createdAt: new Date(),
  kind: "INewMessageWithoutContent"
};
const aRetrievedMessageWithoutContent = {
  ...cosmosMetadata,
  ...aSerializedNewMessageWithoutContent,
  isPending: false,
  createdAt: new Date()
};

const aMaxThreshold = new Date();
aMaxThreshold.setDate(aMaxThreshold.getDate() + 10);

const mockMessageStatusModel = {
  create: jest.fn()
} as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("handle", () => {
  it("GIVEN an not pending message without a message_status WHEN handle the change feed THEN return a 200", async () => {
    const mockPatchAllVersion = jest
      .spyOn(HANDLE, "patchAllVersion")
      .mockReturnValueOnce(() =>
        TE.right([
          { statusCode: 404 },
          { statusCode: 424 }
        ] as OperationResponse[])
      );
    mockMessageStatusModel.create.mockReturnValueOnce(TE.right({}));
    const results = await HANDLE.handle(
      mockContainer,
      mockMessageStatusModel,
      aMaxThreshold,
      [aRetrievedMessageWithoutContent]
    );
    expect(results).toEqual([200]);
    expect(mockPatchAllVersion).toBeCalledTimes(1);
    expect(mockMessageStatusModel.create).toBeCalledWith(
      expect.objectContaining({
        fiscalCode: aFiscalCode,
        isArchived: false,
        isRead: false,
        messageId: aRetrievedMessageWithoutContent.id,
        status: "PROCESSED"
      })
    );
  });
  it("GIVEN an existing message WHEN handle the change feed THEN return a 200", async () => {
    const mockPatchAllVersion = jest
      .spyOn(HANDLE, "patchAllVersion")
      .mockReturnValueOnce(() =>
        TE.right([
          { statusCode: 200 },
          { statusCode: 404 },
          { statusCode: 424 }
        ] as OperationResponse[])
      );
    const results = await HANDLE.handle(
      mockContainer,
      mockMessageStatusModel,
      aMaxThreshold,
      [aRetrievedMessageWithoutContent]
    );
    expect(results).toEqual([200]);
    expect(mockPatchAllVersion).toBeCalledTimes(1);
    expect(mockMessageStatusModel.create).toBeCalledTimes(0);
  });

  it("GIVEN an existing message WHEN handle the change feed THEN return a 200", async () => {
    jest
      .spyOn(HANDLE, "patchAllVersion")
      .mockReturnValueOnce(() =>
        TE.right([
          { statusCode: 200 },
          { statusCode: 404 },
          { statusCode: 424 }
        ] as OperationResponse[])
      );
    const results = await HANDLE.handle(
      mockContainer,
      mockMessageStatusModel,
      aMaxThreshold,
      [aRetrievedMessageWithoutContent]
    );
    expect(results).toEqual([200]);
    expect(mockMessageStatusModel.create).toBeCalledTimes(0);
  });

  it("GIVEN a not working cosmos WHEN handle the change feed THEN throw a CosmosError", async () => {
    jest.spyOn(HANDLE, "patchAllVersion").mockReturnValueOnce(() =>
      TE.left({
        error: {
          message: "Error patching document [500]",
          name: "Patching Error"
        },
        kind: "COSMOS_ERROR_RESPONSE"
      })
    );
    await expect(
      HANDLE.handle(mockContainer, mockMessageStatusModel, aMaxThreshold, [
        aRetrievedMessageWithoutContent
      ])
    ).rejects.toEqual(
      expect.objectContaining({ kind: "COSMOS_ERROR_RESPONSE" })
    );
    expect(mockMessageStatusModel.create).toBeCalledTimes(0);
  });

  it("GIVEN an existing message created after the maxThreshold WHEN handle the change feed THEN return a 0", async () => {
    const mockPatchAllVersion = jest
      .spyOn(HANDLE, "patchAllVersion")
      .mockReturnValueOnce(() =>
        TE.right([
          { statusCode: 200 },
          { statusCode: 404 },
          { statusCode: 424 }
        ] as OperationResponse[])
      );
    const results = await HANDLE.handle(
      mockContainer,
      mockMessageStatusModel,
      new Date("2022-03-22T00:00:00"),
      [aRetrievedMessageWithoutContent]
    );
    expect(results).toEqual([0]);
    expect(mockPatchAllVersion).toBeCalledTimes(0);
    expect(mockMessageStatusModel.create).toBeCalledTimes(0);
  });
});
