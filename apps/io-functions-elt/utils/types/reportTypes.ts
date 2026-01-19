import { PaymentData } from "@pagopa/io-functions-commons/dist/generated/definitions/PaymentData";
import { ServiceScopeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceScope";
import { RetrievedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/src/models/message";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

export type MessageReport = t.TypeOf<typeof MessageReport>;
export const MessageReport = t.interface({
  delivered: t.number,
  delivered_payment: t.number,

  sent: t.number,
  serviceId: NonEmptyString,
  with_content: t.number
});

export const MessageReportArray = t.array(MessageReport);

export type MessageReportExtended = t.TypeOf<typeof MessageReportExtended>;
export const MessageReportExtended = t.intersection([
  MessageReport,
  t.interface({
    organizationName: t.string,
    serviceName: t.string
  })
]);

export const WithContentMessage = t.interface({
  content: t.unknown
});

export const PaymentMessage = t.interface({
  content: t.interface({ payment_data: PaymentData })
});
export const RetrievedNotPendingMessage = t.intersection([
  RetrievedMessageWithoutContent,
  t.interface({ isPending: t.literal(false) })
]);

// -----------
// visible-services-extended.json types
// -----------

const ServiceExportCompact = t.interface({
  // Service Id
  i: NonEmptyString,
  // Service name
  n: NonEmptyString,
  // Quality flag, can be 1 or 0.
  // 0. required quality level not reached
  // 1. quality level reached
  q: t.number
});
type ServiceExportCompact = t.TypeOf<typeof ServiceExportCompact>;

const ServiceExportExtended = t.intersection([
  t.interface({
    sc: enumType<ServiceScopeEnum>(ServiceScopeEnum, "ServiceScope")
  }),
  t.partial({
    // Service description
    d: NonEmptyString
  }),
  ServiceExportCompact
]);
type ServiceExportExtended = t.TypeOf<typeof ServiceExportExtended>;

export const ServicesExportExtended = t.interface({
  fc: OrganizationFiscalCode,
  // Organization Name
  o: NonEmptyString,
  s: t.readonlyArray(ServiceExportExtended)
});
export type ServicesExportExtended = t.TypeOf<typeof ServicesExportExtended>;

export const VisibleServicesExtended = t.readonlyArray(ServicesExportExtended);
export type VisibleServicesExtended = t.TypeOf<typeof VisibleServicesExtended>;
