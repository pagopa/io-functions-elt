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
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";

import { MessageContentType } from "../../generated/avro/dto/MessageContentTypeEnum";
import { MessageCrudOperation } from "../../generated/avro/dto/MessageCrudOperationEnum";
import { MessageFeatureLevelType } from "../../generated/avro/dto/MessageFeatureLevelTypeEnum";
import { message as avroMessage } from "../../generated/avro/dto/message";
import { MessageFormatter } from "../kafka/KafkaTypes";

export type ThirdPartyDataWithCategoryFetcher = (
  serviceId: ServiceId
) => MessageContentType;

interface IMessageCategoryMapping {
  readonly tag: (
    message: RetrievedMessageWithContent,
    categoryFetcher: ThirdPartyDataWithCategoryFetcher
  ) => MessageContentType;
  readonly pattern: t.Type<Partial<MessageContent>>;
}

const messageCategoryMappings: ReadonlyArray<IMessageCategoryMapping> = [
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
): Omit<avroMessage, "schema" | "subject"> =>
  // eslint-disable-next-line no-console, no-underscore-dangle
  {
    const paymentData = RetrievedMessageWithContent.is(retrievedMessage)
      ? retrievedMessage.content.payment_data
      : undefined;

    return {
      op: retrievedMessage.isPending
        ? MessageCrudOperation.CREATE
        : MessageCrudOperation.UPDATE,

      featureLevelType: formatFeatureLevelType(
        retrievedMessage.featureLevelType
      ),
      senderServiceId: retrievedMessage.senderServiceId,
      senderUserId: retrievedMessage.senderUserId,
      id: retrievedMessage.id,
      isPending:
        retrievedMessage.isPending === undefined
          ? true
          : retrievedMessage.isPending,

      content_subject: RetrievedMessageWithContent.is(retrievedMessage)
        ? retrievedMessage.content.subject
        : "",
      content_type: RetrievedMessageWithContent.is(retrievedMessage)
        ? getCategory(retrievedMessage, categoryFetcher)
        : null,
      content_paymentData_amount: paymentData?.amount ?? 0,
      content_paymentData_noticeNumber: paymentData?.notice_number ?? "",
      content_paymentData_invalidAfterDueDate:
        paymentData?.invalid_after_due_date ?? false,
      content_paymentData_payeeFiscalCode:
        paymentData?.payee?.fiscal_code ?? "",
      createdAt: retrievedMessage.createdAt.getTime(),
      timeToLiveSeconds: retrievedMessage.timeToLiveSeconds,
      // eslint-disable-next-line no-underscore-dangle
      timestamp: retrievedMessage._ts * 1000
    };
  };

export const avroMessageFormatter =
  (
    categoryFetcher: ThirdPartyDataWithCategoryFetcher
  ): // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  MessageFormatter<RetrievedMessage> =>
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
