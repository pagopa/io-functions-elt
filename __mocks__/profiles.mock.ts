import {
  NonNegativeInteger,
  WithinRangeInteger
} from "@pagopa/ts-commons/lib/numbers";
import {
  EmailString,
  FiscalCode,
  NonEmptyString,
  OrganizationFiscalCode
} from "@pagopa/ts-commons/lib/strings";

import {
  RetrievedService,
  toAuthorizedCIDRs,
  toAuthorizedRecipients,
  ValidService
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { MaxAllowedPaymentAmount } from "@pagopa/io-functions-commons/dist/generated/definitions/MaxAllowedPaymentAmount";
import { ServiceScopeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceScope";
import { StandardServiceCategoryEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/StandardServiceCategory";
import { CIDR } from "@pagopa/io-functions-commons/dist/generated/definitions/CIDR";
import { Profile, RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";

export const aFiscalCode = "AAABBB01C02D345D" as FiscalCode;
export const anotherFiscalCode = "AAABBB01C02D345W" as FiscalCode;

export const aToken = "123456789";

export const aCosmosMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "xyz",
  _ts: 1
};

export const aProfile: Profile = {
  fiscalCode: aFiscalCode,
  email: "xxx@xxx.xx" as EmailString,
  servicePreferencesSettings:{
    mode: ServicesPreferencesModeEnum.AUTO,
    version: 0 as NonNegativeInteger
  },
  acceptedTosVersion: 1,
  blockedInboxOrChannels: {a: []},
  isEmailEnabled: true,
  isEmailValidated: true,
  isInboxEnabled: true,
  isTestProfile: true,
  isWebhookEnabled: true,
  lastAppVersion: "UNKNOWN",
  preferredLanguages: [],
  pushNotificationsContentType: "UNSET",
  reminderStatus: "UNSET",
};

export const aRetrievedProfile: RetrievedProfile = {
  id: `${aFiscalCode}-00000001` as NonEmptyString,
  version: 1 as NonNegativeInteger,
  kind: "IRetrievedProfile",
  ...aProfile,
  ...aCosmosMetadata
};

// const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;
// const anEmail = "test@example.com" as EmailString;
// const aServiceId = "s123" as NonEmptyString;

// export const aService = {
//   authorizedCIDRs: toAuthorizedCIDRs([]),
//   authorizedRecipients: toAuthorizedRecipients([]),
//   departmentName: "MyDept" as NonEmptyString,
//   isVisible: true,
//   maxAllowedPaymentAmount: 100 as MaxAllowedPaymentAmount,
//   organizationFiscalCode: anOrganizationFiscalCode,
//   organizationName: "MyOrg" as NonEmptyString,
//   requireSecureChannels: false,
//   serviceId: aServiceId,
//   serviceName: "MyService" as NonEmptyString
// };

// export const aValidService: ValidService = {
//   authorizedCIDRs: new Set((["0.0.0.0"] as unknown) as CIDR[]),
//   authorizedRecipients: new Set([aFiscalCode, anotherFiscalCode]),
//   departmentName: "department" as NonEmptyString,
//   isVisible: true,
//   maxAllowedPaymentAmount: (0 as unknown) as number &
//     WithinRangeInteger<0, 9999999999>,
//   organizationFiscalCode: "01234567890" as OrganizationFiscalCode,
//   organizationName: "Organization" as NonEmptyString,
//   requireSecureChannels: true,
//   serviceId: "01234567890" as NonEmptyString,
//   serviceName: "Service" as NonEmptyString,
//   serviceMetadata: {
//     description: "Service Description" as NonEmptyString,
//     privacyUrl: "https://example.com/privacy.html" as NonEmptyString,
//     supportUrl: "https://example.com/support.html" as NonEmptyString,
//     scope: ServiceScopeEnum.NATIONAL,
//     category: StandardServiceCategoryEnum.STANDARD,
//     customSpecialFlow: undefined
//   }
// };

// export const aRetrievedService: RetrievedService = {
//   ...aService,
//   id: "aServiceId" as NonEmptyString,
//   version: 1 as NonNegativeInteger,
//   _etag: "_etag",
//   _rid: "_rid",
//   _self: "_self",
//   _ts: 1639739512,
//   kind: "IRetrievedService"
// };

// export const aValidRetrievedService: RetrievedService = {
//   ...aValidService,
//   id: "aValidRetrievedServiceId" as NonEmptyString,
//   version: 1 as NonNegativeInteger,
//   _etag: "_etag",
//   _rid: "_rid",
//   _self: "_self",
//   _ts: 1639739512,
//   kind: "IRetrievedService"
// };
