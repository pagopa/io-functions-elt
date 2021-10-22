/* eslint-disable @typescript-eslint/naming-convention */
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import * as avro from "avsc";
import { MessageFormatter } from "../kafka/KafkaTypes";
import { services } from "../../generated/avro/dto/services";
import { CrudOperation } from "../../generated/avro/dto/CrudOperationEnum";

export const avroServiceFormatter: MessageFormatter<RetrievedService> = message => ({
  value: avro.Type.forSchema(
    services.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
  ).toBuffer(
    Object.assign(new services(), {
      departmentName: message.departmentName,
      id: message.id,
      isVisible: message.isVisible,
      maxAllowedPaymentAmount: message.maxAllowedPaymentAmount,
      metadata_address: message?.serviceMetadata?.address ?? "",
      metadata_appAndroid: message?.serviceMetadata?.appAndroid ?? "",
      metadata_appIos: message?.serviceMetadata?.appIos ?? "",
      metadata_cta: message?.serviceMetadata?.cta ?? "",
      metadata_description: message?.serviceMetadata?.description ?? "",
      metadata_email: message?.serviceMetadata?.email ?? "",
      metadata_pec: message?.serviceMetadata?.pec ?? "",
      metadata_phone: message?.serviceMetadata?.phone ?? "",
      metadata_privacyUrl: message?.serviceMetadata?.privacyUrl ?? "",
      metadata_scope: message?.serviceMetadata?.scope ?? "",
      metadata_supportUrl: message?.serviceMetadata?.supportUrl ?? "",
      metadata_tokenName: message?.serviceMetadata?.tokenName ?? "",
      metadata_tosUrl: message?.serviceMetadata?.tosUrl ?? "",
      metadata_webUrl: message?.serviceMetadata?.webUrl ?? "",
      op: message.version === 0 ? CrudOperation.CREATE : CrudOperation.UPDATE,
      organizationFiscalCode: message.organizationFiscalCode,
      organizationName: message.organizationName,
      requireSecureChannels: message.requireSecureChannels,
      serviceId: message.serviceId,
      serviceName: message.serviceName,
      version: message.version
    })
  )
});
