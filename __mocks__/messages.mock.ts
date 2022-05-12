import {
  NewMessageWithoutContent,
  RetrievedMessageWithoutContent
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "@pagopa/io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";
import { FiscalCode } from "@pagopa/io-functions-commons/dist/generated/definitions/FiscalCode";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { RetrievedMessage } from "@pagopa/io-functions-commons/dist/src/models/message";
import {
  NewMessageStatus,
  RetrievedMessageStatus
} from "@pagopa/io-functions-commons/dist/src/models/message_status";
import { MessageStatusValueEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageStatusValue";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FeatureLevelTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/FeatureLevelType";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aMessageId = "A_MESSAGE_ID" as NonEmptyString;

const aNewMessageWithoutContent: NewMessageWithoutContent = {
  createdAt: new Date(),
  featureLevelType: FeatureLevelTypeEnum.STANDARD,
  fiscalCode: aFiscalCode,
  id: aMessageId,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  isPending: false,
  kind: "INewMessageWithoutContent",
  senderServiceId: "test" as ServiceId,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

export const aCosmosMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "xyz",
  _ts: 1
};

export const aRetrievedMessageWithoutContent: RetrievedMessageWithoutContent = {
  ...aNewMessageWithoutContent,
  ...aCosmosMetadata,
  kind: "IRetrievedMessageWithoutContent"
};

export const aGenericContent = {
  subject: "t".repeat(80),
  markdown: "t".repeat(120)
};

export const aRetrievedMessage: RetrievedMessage = aRetrievedMessageWithoutContent;

export const aNewMessageStatus: NewMessageStatus = {
  messageId: aMessageId,
  status: MessageStatusValueEnum.PROCESSED,
  updatedAt: new Date(),
  isRead: true,
  isArchived: false,
  fiscalCode: aFiscalCode,
  kind: "INewMessageStatus"
};

export const aRetrievedMessageStatus: RetrievedMessageStatus = {
  ...aNewMessageStatus,
  ...aCosmosMetadata,
  version: 0 as NonNegativeInteger,
  id: `${aNewMessageStatus.messageId}-00000000` as NonEmptyString,
  kind: "IRetrievedMessageStatus"
};
