import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as EA from "../messages-outbound-enricher";
import * as RA from "fp-ts/ReadonlyArray";
import { pipe } from "fp-ts/lib/function";
import { FeatureLevelTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/FeatureLevelType";
import { MessageBodyMarkdown } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageBodyMarkdown";
import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";
import { MessageSubject } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageSubject";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "@pagopa/io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";
import {
  NewMessageWithoutContent,
  RetrievedMessageWithoutContent
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { isFailure, isSuccess } from "../../port/outbound-publisher";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
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

const mockGetContentFromBlob = jest.fn();
const adapter = EA.create(
  {
    getContentFromBlob: mockGetContentFromBlob
  } as any,
  {} as any
);
const useWorkingGetContentFromBlob = () =>
  mockGetContentFromBlob.mockImplementation(() =>
    TE.of(O.some(aMessageContent))
  );

describe("enrichs", () => {
  beforeAll(() => jest.clearAllMocks());
  it("GIVEN a working Blob Storage client, WHEN enriching a document, THEN retrieve the message content and enrich it", async () => {
    // Given
    useWorkingGetContentFromBlob();
    const documents = RA.makeBy(10, i => ({
      ...aRetrievedMessageWithoutContent,
      senderUserId: `${aRetrievedMessageWithoutContent.senderServiceId}_${i}` as NonEmptyString
    }));
    // When
    const messageOrErrors = await adapter.enrichs(documents)();
    // Then
    pipe(
      documents,
      RA.mapWithIndex((i, originalMessage) => {
        expect(isSuccess(messageOrErrors[i])).toBeTruthy();
        expect(messageOrErrors[i]).toEqual(
          expect.objectContaining({
            document: {
              ...originalMessage,
              content: aMessageContent,
              kind: "IRetrievedMessageWithContent"
            }
          })
        );
      })
    );
  });

  it("GIVEN an empty content blob, WHEN enriching a document, THEN return a left", async () => {
    // Given
    mockGetContentFromBlob.mockImplementation(() => TE.of(O.none));
    const documents = RA.makeBy(10, i => ({
      ...aRetrievedMessageWithoutContent,
      senderUserId: `${aRetrievedMessageWithoutContent.senderServiceId}_${i}` as NonEmptyString
    }));
    // When
    const messageOrErrors = await adapter.enrichs(documents)();
    // Then
    pipe(
      documents,
      RA.mapWithIndex((i, originalMessage) => {
        expect(isFailure(messageOrErrors[i])).toBeTruthy();
        expect(messageOrErrors[i]).toEqual(
          expect.objectContaining({
            document: originalMessage
          })
        );
      })
    );
  });

  it("GIVEN a not working Blob Storage client, WHEN enriching a document, THEN return a left", async () => {
    // Given
    mockGetContentFromBlob.mockImplementation(() => TE.left(anError));
    const documents = RA.makeBy(10, i => ({
      ...aRetrievedMessageWithoutContent,
      senderUserId: `${aRetrievedMessageWithoutContent.senderServiceId}_${i}` as NonEmptyString
    }));
    // When
    const messageOrErrors = await adapter.enrichs(documents)();
    // Then
    pipe(
      documents,
      RA.mapWithIndex((i, originalMessage) => {
        expect(isFailure(messageOrErrors[i])).toBeTruthy();
        expect(messageOrErrors[i]).toEqual(
          expect.objectContaining({
            document: originalMessage,
            error: anError
          })
        );
      })
    );
  });

  it("GIVEN a first-time-only not working Blob Storage client, WHEN enriching a document, THEN return a left", async () => {
    // Given
    useWorkingGetContentFromBlob();
    mockGetContentFromBlob.mockImplementationOnce(() => TE.left(anError));
    const documents = RA.makeBy(10, i => ({
      ...aRetrievedMessageWithoutContent,
      senderUserId: `${aRetrievedMessageWithoutContent.senderServiceId}_${i}` as NonEmptyString
    }));
    // When
    const messageOrErrors = await adapter.enrichs(documents)();
    // Then
    pipe(
      documents,
      RA.mapWithIndex((i, originalMessage) => {
        expect(isSuccess(messageOrErrors[i])).toEqual(i != 0);
        expect(messageOrErrors[i]).toEqual(
          expect.objectContaining({
            document:
              i == 0
                ? originalMessage
                : {
                    ...originalMessage,
                    content: aMessageContent,
                    kind: "IRetrievedMessageWithContent"
                  }
          })
        );
      })
    );
  });
});

describe("enrich", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a working Blob Storage client, WHEN enriching a document, THEN retrieve the message content and enrich it", async () => {
    // Given
    useWorkingGetContentFromBlob();
    // When
    const messageOrError = await adapter.enrich(
      aRetrievedMessageWithoutContent
    )();
    // Then
    expect(E.isRight(messageOrError)).toBeTruthy();
    expect(messageOrError).toEqual(
      expect.objectContaining({
        right: {
          ...aRetrievedMessageWithoutContent,
          content: aMessageContent,
          kind: "IRetrievedMessageWithContent"
        }
      })
    );
  });

  it("GIVEN an empty content blob, WHEN enriching a document, THEN return a left", async () => {
    // Given
    mockGetContentFromBlob.mockImplementation(() => TE.of(O.none));
    // When
    const messageOrError = await adapter.enrich(
      aRetrievedMessageWithoutContent
    )();
    // Then
    expect(E.isLeft(messageOrError)).toBeTruthy();
  });

  it("GIVEN a not working Blob Storage client, WHEN enriching a document, THEN return a left", async () => {
    // Given
    mockGetContentFromBlob.mockImplementationOnce(() => TE.left(anError));
    // When
    const messageOrError = await adapter.enrich(
      aRetrievedMessageWithoutContent
    )();
    // Then
    expect(E.isLeft(messageOrError)).toBeTruthy();
  });
});
