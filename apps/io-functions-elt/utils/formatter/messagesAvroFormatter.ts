import { EUCovidCert } from "@pagopa/io-functions-commons/dist/generated/definitions/EUCovidCert";
import { FeatureLevelTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/FeatureLevelType";
import { LegalData } from "@pagopa/io-functions-commons/dist/generated/definitions/LegalData";
import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";
import { PaymentData } from "@pagopa/io-functions-commons/dist/generated/definitions/PaymentData";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { ThirdPartyData } from "@pagopa/io-functions-commons/dist/generated/definitions/ThirdPartyData";
import {
  RetrievedMessage,
  RetrievedMessageWithContent
} from "@pagopa/io-functions-commons/dist/src/models/message";
import * as avro from "avsc";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as t from "io-ts";

import { message as avroMessage } from "../../generated/avro/dto/message";
import { MessageContentType } from "../../generated/avro/dto/MessageContentTypeEnum";
import { MessageCrudOperation } from "../../generated/avro/dto/MessageCrudOperationEnum";
import { MessageFeatureLevelType } from "../../generated/avro/dto/MessageFeatureLevelTypeEnum";
import { MessageFormatter } from "../kafka/KafkaTypes";

export type ThirdPartyDataWithCategoryFetcher = (
  serviceId: ServiceId
) => MessageContentType;

interface IMessageCategoryMapping {
  readonly pattern: t.Type<Partial<MessageContent>>;
  readonly tag: (
    message: RetrievedMessageWithContent,
    categoryFetcher: ThirdPartyDataWithCategoryFetcher
  ) => MessageContentType;
}

const messageCategoryMappings: readonly IMessageCategoryMapping[] = [
  {
    pattern: t.interface({ eu_covid_cert: EUCovidCert }) as t.Type<
      Partial<MessageContent>
    >,
    tag: () => MessageContentType.EU_COVID_CERT
  },
  {
    pattern: t.interface({ legal_data: LegalData }) as t.Type<
      Partial<MessageContent>
    >,
    tag: () => MessageContentType.LEGAL
  },
  {
    pattern: t.interface({ third_party_data: ThirdPartyData }) as t.Type<
      Partial<MessageContent>
    >,
    tag: (message, fetcher) => fetcher(message.senderServiceId)
  },
  {
    pattern: t.interface({ payment_data: PaymentData }) as t.Type<
      Partial<MessageContent>
    >,
    tag: () => MessageContentType.PAYMENT
  }
];

const getCategory = (
  message: RetrievedMessageWithContent,
  categoryFetcher: ThirdPartyDataWithCategoryFetcher
): MessageContentType =>
  pipe(
    messageCategoryMappings,
    RA.map((mapping) =>
      pipe(
        message.content,
        mapping.pattern.decode,
        E.fold(
          () => O.none,
          () => O.some(mapping.tag(message, categoryFetcher))
        )
      )
    ),
    RA.filter(O.isSome),
    RA.map((v) => v.value),
    RA.head,
    O.getOrElseW(() => MessageContentType.GENERIC)
  );

const formatFeatureLevelType = (
  featureLevelType: FeatureLevelTypeEnum
): MessageFeatureLevelType =>
  MessageFeatureLevelType[featureLevelType] ?? MessageFeatureLevelType.STANDARD;

export const buildAvroMessagesObject = (
  retrievedMessage: RetrievedMessage,
  categoryFetcher: ThirdPartyDataWithCategoryFetcher
): Omit<avroMessage, "schema" | "subject"> => {
  const paymentData = RetrievedMessageWithContent.is(retrievedMessage)
    ? retrievedMessage.content.payment_data
    : undefined;

  return {
    content_paymentData_amount: paymentData?.amount ?? 0,

    content_paymentData_invalidAfterDueDate:
      paymentData?.invalid_after_due_date ?? false,
    content_paymentData_noticeNumber: paymentData?.notice_number ?? "",
    content_paymentData_payeeFiscalCode: paymentData?.payee?.fiscal_code ?? "",
    content_subject: RetrievedMessageWithContent.is(retrievedMessage)
      ? retrievedMessage.content.subject
      : "",
    content_type: RetrievedMessageWithContent.is(retrievedMessage)
      ? getCategory(retrievedMessage, categoryFetcher)
      : null,

    createdAt: retrievedMessage.createdAt.getTime(),
    featureLevelType: formatFeatureLevelType(retrievedMessage.featureLevelType),
    id: retrievedMessage.id,
    isPending:
      retrievedMessage.isPending === undefined
        ? true
        : retrievedMessage.isPending,
    op: retrievedMessage.isPending
      ? MessageCrudOperation.CREATE
      : MessageCrudOperation.UPDATE,
    senderServiceId: retrievedMessage.senderServiceId,
    senderUserId: retrievedMessage.senderUserId,

    timestamp: retrievedMessage._ts * 1000,
    timeToLiveSeconds: retrievedMessage.timeToLiveSeconds
  };
};

export const avroMessageFormatter =
  (
    categoryFetcher: ThirdPartyDataWithCategoryFetcher
  ): MessageFormatter<RetrievedMessage> =>
  (message) => ({
    key: message.id,
    value: avro.Type.forSchema(
      avroMessage.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
    ).toBuffer(
      Object.assign(
        new avroMessage(),
        buildAvroMessagesObject(message, categoryFetcher)
      )
    )
  });
