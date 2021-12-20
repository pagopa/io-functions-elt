/* eslint-disable @typescript-eslint/naming-convention */
import {
  RetrievedService,
  ValidService
} from "@pagopa/io-functions-commons/dist/src/models/service";
import * as avro from "avsc";
import { MessageFormatter } from "../kafka/KafkaTypes";
import { services } from "../../generated/avro/dto/services";
import { CrudOperation } from "../../generated/avro/dto/CrudOperationEnum";

export const buildAvroServiceObject = (
  retrievedService: RetrievedService,
  SERVICEID_EXCLUSION_LIST: ReadonlyArray<string>
): Omit<services, "schema" | "subject"> => {
  // eslint-disable-next-line no-console, no-underscore-dangle
  console.log("TIMESTAMP", retrievedService._ts);
  return {
    departmentName: retrievedService.departmentName,
    id: retrievedService.id,
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
    version: retrievedService.version,
    // eslint-disable-next-line sort-keys, no-underscore-dangle
    timestamp: retrievedService._ts,

    // --------------------
    // Calculated values
    // --------------------
    // eslint-disable-next-line sort-keys
    isQuality:
      SERVICEID_EXCLUSION_LIST.indexOf(retrievedService.serviceId) > -1
        ? true
        : ValidService.is(retrievedService)
  };
};

export const avroServiceFormatter = (
  SERVICEID_EXCLUSION_LIST: ReadonlyArray<string>
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
): MessageFormatter<RetrievedService> => message => ({
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
