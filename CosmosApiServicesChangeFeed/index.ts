/* eslint-disable @typescript-eslint/naming-convention */ // disabled in order to use the naming convention used to flatten nested object to root ('_' char used as nested object separator)
import * as winston from "winston";
import * as avro from "avsc";
import { Context } from "@azure/functions";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import * as KP from "../utils/kafka/kafkaProducer";
import { services } from "../generated/avro/dto/services";
import { CrudOperation } from "../generated/avro/dto/CrudOperationEnum";
import {
  MessageFormatter,
  ValidableKafkaProducerConfig
} from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow } from "../utils/config";
import { handleServicesChange } from "./handler";

// eslint-disable-next-line functional/no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

const avroServiceFormatter: MessageFormatter<RetrievedService> = message => ({
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

const config = getConfigOrThrow();

const kakfaClient = KP.fromConfig(
  config.targetKafka as ValidableKafkaProducerConfig // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
);

const servicesTopic = {
  ...config.servicesTopic,
  messageFormatter: avroServiceFormatter
};

const changeFeedStart = async (
  context: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> => {
  logger = context.log;
  return handleServicesChange(kakfaClient, servicesTopic, documents);
};

export default changeFeedStart;
