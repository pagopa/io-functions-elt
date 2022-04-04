import {
  NewMessageWithoutContent,
  RetrievedMessageWithoutContent
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "@pagopa/io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";
import { FiscalCode } from "@pagopa/io-functions-commons/dist/generated/definitions/FiscalCode";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aNewMessageWithoutContent: NewMessageWithoutContent = {
  createdAt: new Date(),
  fiscalCode: aFiscalCode,
  id: "A_MESSAGE_ID" as NonEmptyString,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  isPending: false,
  kind: "INewMessageWithoutContent",
  senderServiceId: "test" as ServiceId,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

export const aRetrievedMessageWithoutContent: RetrievedMessageWithoutContent = {
  ...aNewMessageWithoutContent,
  _etag: "_etag",
  _rid: "_rid",
  _self: "xyz",
  _ts: 1,
  kind: "IRetrievedMessageWithoutContent"
};

export const aGenericContent = {
  subject: "t".repeat(80),
  markdown: "t".repeat(120)
};
