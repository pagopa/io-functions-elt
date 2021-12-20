import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  EmailString,
  NonEmptyString,
  OrganizationFiscalCode
} from "@pagopa/ts-commons/lib/strings";

import {
  RetrievedService,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { MaxAllowedPaymentAmount } from "@pagopa/io-functions-commons/dist/generated/definitions/MaxAllowedPaymentAmount";

const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;
const anEmail = "test@example.com" as EmailString;
const aServiceId = "s123" as NonEmptyString;

export const aService = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDept" as NonEmptyString,
  id: "xyz" as NonEmptyString,
  isVisible: true,
  maxAllowedPaymentAmount: 100 as MaxAllowedPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyOrg" as NonEmptyString,
  requireSecureChannels: false,
  serviceId: aServiceId,
  serviceName: "MyService" as NonEmptyString,
  version: 1 as NonNegativeInteger
};

export const aRetrievedService: RetrievedService = {
  ...aService,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1639739512,
  kind: "IRetrievedService"
};
