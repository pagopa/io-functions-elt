/* eslint-disable sort-keys */
import { RetrievedMessageStatus } from "@pagopa/io-functions-commons/dist/src/models/message_status";
import * as avro from "avsc";
import { MessageStatusValueEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageStatusValue";
import { MessageFormatter } from "../kafka/KafkaTypes";
import { messageStatus } from "../../generated/avro/dto/messageStatus";
import { MessageStatusCrudOperation as CrudOperation } from "../../generated/avro/dto/MessageStatusCrudOperationEnum";
import { MessageStatus as AvroMessageStatus } from "../../generated/avro/dto/MessageStatusEnum";

const formatStatus = (status: MessageStatusValueEnum): AvroMessageStatus =>
  AvroMessageStatus[status];

export const buildAvroServiceObject = (
  retrievedMessageStatus: RetrievedMessageStatus
): Omit<messageStatus, "schema" | "subject"> => ({
  id: retrievedMessageStatus.id,
  messageId: retrievedMessageStatus.messageId,
  status: formatStatus(retrievedMessageStatus.status),
  updatedAt: retrievedMessageStatus.updatedAt.getTime(),
  version: retrievedMessageStatus.version,
  isRead: retrievedMessageStatus.isRead,
  isArchived: retrievedMessageStatus.isArchived,
  op:
    retrievedMessageStatus.version === 0
      ? CrudOperation.CREATE
      : CrudOperation.UPDATE,
  // eslint-disable-next-line sort-keys, no-underscore-dangle
  timestamp: retrievedMessageStatus._ts * 1000
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const messageStatusAvroFormatter = (): MessageFormatter<RetrievedMessageStatus> => message => ({
  // messageId as Partition Key
  key: message.messageId,
  value: avro.Type.forSchema(
    messageStatus.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
  ).toBuffer(
    Object.assign(new messageStatus(), buildAvroServiceObject(message))
  )
});
