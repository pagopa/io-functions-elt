/* eslint-disable sort-keys */
/* eslint-disable @typescript-eslint/naming-convention */
import * as avro from "avsc";

import * as t from "io-ts";

import * as RA from "fp-ts/ReadonlyArray";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";

import {
  RetrievedMessage,
  RetrievedMessageWithContent
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";
import { EUCovidCert } from "@pagopa/io-functions-commons/dist/generated/definitions/EUCovidCert";
import { PaymentData } from "@pagopa/io-functions-commons/dist/generated/definitions/PaymentData";
import { LegalData } from "@pagopa/io-functions-commons/dist/generated/definitions/LegalData";

import { MessageFormatter } from "../kafka/KafkaTypes";
import { message as avroMessage } from "../../generated/avro/dto/message";
import { MessageCrudOperation } from "../../generated/avro/dto/MessageCrudOperationEnum";
import { MessageContentType } from "../../generated/avro/dto/MessageContentTypeEnum";

interface IMessageCategoryMapping {
  readonly tag: MessageContentType;
  readonly pattern: t.Type<Partial<MessageContent>>;
}

const messageCategoryMappings: ReadonlyArray<IMessageCategoryMapping> = [
  {
    pattern: t.interface({ eu_covid_cert: EUCovidCert }) as t.Type<
      Partial<MessageContent>
    >,
    tag: MessageContentType.EU_COVID_CERT
  },
  {
    pattern: t.interface({ legal_data: LegalData }) as t.Type<
      Partial<MessageContent>
    >,
    tag: MessageContentType.LEGAL
  },
  {
    pattern: t.interface({ payment_data: PaymentData }) as t.Type<
      Partial<MessageContent>
    >,
    tag: MessageContentType.PAYMENT
  }
];

const getCategory = (content: MessageContent): MessageContentType =>
  pipe(
    messageCategoryMappings,
    RA.map(mapping =>
      pipe(
        content,
        mapping.pattern.decode,
        E.fold(
          () => O.none,
          _ => O.some(mapping.tag)
        )
      )
    ),
    RA.filter(O.isSome),
    RA.map(v => v.value),
    RA.head,
    O.getOrElseW(() => MessageContentType.GENERIC)
  );

export const buildAvroMessagesObject = (
  retrievedMessage: RetrievedMessage
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
        ? getCategory(retrievedMessage.content)
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

export const avroMessageFormatter = (): // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
MessageFormatter<RetrievedMessage> => message => ({
  key: message.id,
  value: avro.Type.forSchema(
    avroMessage.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
  ).toBuffer(Object.assign(new avroMessage(), buildAvroMessagesObject(message)))
});