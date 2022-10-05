import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as EA from "../messages-outbound-enricher";
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

const mockGetContentFromBlob = jest
  .fn()
  .mockImplementation(() => TE.of(O.some(aMessageContent)));
const adapter = EA.create(
  {
    getContentFromBlob: mockGetContentFromBlob
  } as any,
  {} as any
);

describe("publish", () => {
  it("GIVEN a working Blob Storage client, WHEN enriching a document, THEN retrieve the message content and enrich it", async () => {
    // Given

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
