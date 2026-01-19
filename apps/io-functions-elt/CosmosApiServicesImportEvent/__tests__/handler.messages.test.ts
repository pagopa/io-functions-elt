import { BlobService } from "azure-storage";

import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as t from "io-ts";

import {
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { pipe } from "fp-ts/lib/function";

import { aRetrievedMessageWithoutContent } from "../../__mocks__/messages.mock";
import { processMessages } from "../handler.messages";
import {
  buildServiceIterator,
  createContent,
  createContext
} from "../../__mocks__/helpers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ----------------------
// Setup values
// ----------------------

const serviceId1 = "aServiceId1";
const serviceId2 = "aServiceId2";
const serviceId3 = "aServiceId3";

const aProcessedMessageIdWithContent1 = "msgIdWithContent1";
const aProcessedMessageIdWithContent2 = "msgIdWithContent2";
const aProcessedMessageIdWithPaymentContent3 = "msgIdWithContent3";
const aPendingMessageId1 = "pendingMsgId1";
const aPendingMessageId2 = "pendingMsgId2";

const aListOfMessageIds = [
  {
    id: aProcessedMessageIdWithContent1,
    isPending: false,
    senderServiceId: serviceId1
  },
  {
    id: aProcessedMessageIdWithContent2,
    isPending: false,
    senderServiceId: serviceId2
  },
  {
    id: aProcessedMessageIdWithPaymentContent3,
    isPending: false,
    senderServiceId: serviceId1
  },
  { id: aPendingMessageId1, senderServiceId: serviceId3 },
  { id: aPendingMessageId2, isPending: true, senderServiceId: serviceId2 }
];

const aListOfMessages = pipe(
  aListOfMessageIds.map(m => ({
    ...aRetrievedMessageWithoutContent,
    id: m.id,
    indexedId: m.id,
    senderServiceId: m.senderServiceId,
    isPending: m.isPending
  })),
  t.array(RetrievedMessage).decode,
  E.getOrElseW(() => {
    throw Error();
  })
);

const content1 = createContent();
const content2 = createContent();
const content3 = createContent({
  payment_data: {
    amount: 70,
    notice_number: "177777777777777777",
    payee: {
      fiscal_code: "02001829764"
    }
  }
});

// ----------------------
// Mocks
// ----------------------
const messageCollectionIteratorMock = vi.fn(() =>
  buildServiceIterator(aListOfMessages, RetrievedMessage)
);

const returnContent = (returnPaymentContent: boolean = true) => (
  _blobService: BlobService,
  msgId: NonEmptyString
) => {
  switch (msgId) {
    case aProcessedMessageIdWithContent1:
      return TE.of(O.of(content1));
    case aProcessedMessageIdWithContent2:
      return TE.of(O.of(content2));
    case aProcessedMessageIdWithPaymentContent3:
      return returnPaymentContent
        ? TE.of(O.of(content3))
        : TE.left(Error("cannot retrieve content"));
    case aPendingMessageId1:
      return TE.left(Error(""));
    case aPendingMessageId2:
      return TE.left(Error(""));

    default:
      throw Error("This should not happen");
      break;
  }
};

const mockGetContentFromBlob = vi.fn(returnContent());

const messageModelMock = ({
  getContentFromBlob: mockGetContentFromBlob,
  getQueryIterator: messageCollectionIteratorMock
} as unknown) as MessageModel;

// ----------------------
// Tests
// ----------------------
describe("processMessages", () => {
  const mockStoreCSVInBlob = vi.fn((_text: string) =>
    TE.of({} as BlobService.BlobResult)
  );
  const getMockStoreCSVInBlob = vi.fn(
    (_blobName: string) => mockStoreCSVInBlob
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should write correct file", async () => {
    const expected = [
      {
        serviceId: serviceId1,
        sent: 2,
        delivered: 2,
        delivered_payment: 1,
        with_content: 2
      },
      {
        serviceId: serviceId2,
        sent: 2,
        delivered: 1,
        delivered_payment: 0,
        with_content: 1
      },
      {
        serviceId: serviceId3,
        sent: 1,
        delivered: 0,
        delivered_payment: 0,
        with_content: 0
      }
    ];

    const handler = processMessages(
      messageModelMock,
      {} as any,
      getMockStoreCSVInBlob,
      100,
      2,
      50
    );

    const res = await handler(createContext(), 0 /* unused */, 10 /* unused */);

    expect(res).toEqual(expect.objectContaining({ isSuccess: true }));
    expect(mockGetContentFromBlob).toHaveBeenCalledTimes(3);

    const content = mockStoreCSVInBlob.mock.calls[0][0];
    //expect(content).toEqual(JSON.stringify(expected));
    expect(JSON.parse(content)).toEqual(expected);
  });

  it("should exit with success `false` if iterator fails", async () => {
    messageCollectionIteratorMock.mockImplementationOnce(() =>
      buildServiceIterator([], RetrievedMessage, Error("an error"))
    );

    const handler = processMessages(
      messageModelMock,
      {} as any,
      getMockStoreCSVInBlob,
      100,
      2,
      50
    );

    const res = await handler(createContext(), 0 /* unused */, 10 /* unused */);

    expect(res).toEqual(expect.objectContaining({ isSuccess: false }));
  });

  it("should not fail if blobService fails to retrieve a content", async () => {
    const expected = [
      {
        serviceId: serviceId1,
        sent: 2,
        delivered: 2,
        delivered_payment: 0,
        with_content: 1
      },
      {
        serviceId: serviceId2,
        sent: 2,
        delivered: 1,
        delivered_payment: 0,
        with_content: 1
      },
      {
        serviceId: serviceId3,
        sent: 1,
        delivered: 0,
        delivered_payment: 0,
        with_content: 0
      }
    ];

    mockGetContentFromBlob.mockImplementation(returnContent(false));

    getMockStoreCSVInBlob.mockClear();
    const handler = processMessages(
      messageModelMock,
      {} as any,
      getMockStoreCSVInBlob,
      100,
      2,
      50
    );

    const res = await handler(createContext(), 0 /* unused */, 10 /* unused */);

    expect(res).toEqual(expect.objectContaining({ isSuccess: true }));
    expect(mockGetContentFromBlob).toHaveBeenCalledTimes(3);

    const content = mockStoreCSVInBlob.mock.calls[0][0];
    //expect(content).toEqual(JSON.stringify(expected));
    expect(JSON.parse(content)).toEqual(expected);
  });
});
