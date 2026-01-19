import {
  RetrievedService,
  ValidService
} from "@pagopa/io-functions-commons/dist/src/models/service";
import * as avro from "avsc";

import { CrudOperation } from "../../generated/avro/dto/CrudOperationEnum";
import { services } from "../../generated/avro/dto/services";
import { MessageFormatter } from "../kafka/KafkaTypes";

export const buildAvroServiceObject = (
  retrievedService: RetrievedService,
  SERVICEID_EXCLUSION_LIST: readonly string[]
  // eslint-disable-next-line complexity
): Omit<services, "schema" | "subject"> => ({
  departmentName: retrievedService.departmentName,
  id: retrievedService.id,
  // --------------------
  // Calculated values
  // --------------------

  isQuality:
    SERVICEID_EXCLUSION_LIST.indexOf(retrievedService.serviceId) > -1
      ? true
      : ValidService.is(retrievedService),
  isVisible: retrievedService.isVisible,
  maxAllowedPaymentAmount: retrievedService.maxAllowedPaymentAmount,
  metadata_address: retrievedService?.serviceMetadata?.address ?? "",
  metadata_appAndroid: retrievedService?.serviceMetadata?.appAndroid ?? "",
  metadata_appIos: retrievedService?.serviceMetadata?.appIos ?? "",
  metadata_cta: retrievedService?.serviceMetadata?.cta ?? "",
  metadata_description: retrievedService?.serviceMetadata?.description ?? "",
  metadata_email: retrievedService?.serviceMetadata?.email ?? "",
  metadata_pec: retrievedService?.serviceMetadata?.pec ?? "",
  metadata_phone: retrievedService?.serviceMetadata?.phone ?? "",
  metadata_privacyUrl: retrievedService?.serviceMetadata?.privacyUrl ?? "",
  metadata_scope: retrievedService?.serviceMetadata?.scope ?? "",
  metadata_supportUrl: retrievedService?.serviceMetadata?.supportUrl ?? "",
  metadata_tokenName: retrievedService?.serviceMetadata?.tokenName ?? "",
  metadata_tosUrl: retrievedService?.serviceMetadata?.tosUrl ?? "",
  metadata_webUrl: retrievedService?.serviceMetadata?.webUrl ?? "",
  op:
    retrievedService.version === 0
      ? CrudOperation.CREATE
      : CrudOperation.UPDATE,
  organizationFiscalCode: retrievedService.organizationFiscalCode,
  organizationName: retrievedService.organizationName,
  requireSecureChannels: retrievedService.requireSecureChannels,
  serviceId: retrievedService.serviceId,
  serviceName: retrievedService.serviceName,

  timestamp: retrievedService._ts,

  version: retrievedService.version
});

export const avroServiceFormatter =
  (
    SERVICEID_EXCLUSION_LIST: readonly string[]
  ): MessageFormatter<RetrievedService> =>
  (message) => ({
    key: message.serviceId,
    value: avro.Type.forSchema(
      services.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
    ).toBuffer(
      Object.assign(
        new services(),
        buildAvroServiceObject(message, SERVICEID_EXCLUSION_LIST)
      )
    )
  });
