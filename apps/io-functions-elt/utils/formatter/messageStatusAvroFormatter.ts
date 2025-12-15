import { NotRejectedMessageStatusValueEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/NotRejectedMessageStatusValue";
import { RejectedMessageStatusValueEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/RejectedMessageStatusValue";
import { RetrievedMessageStatus } from "@pagopa/io-functions-commons/dist/src/models/message_status";
import * as avro from "avsc";

import { messageStatus } from "../../generated/avro/dto/messageStatus";
import { MessageStatusCrudOperation as CrudOperation } from "../../generated/avro/dto/MessageStatusCrudOperationEnum";
import { MessageStatus as AvroMessageStatus } from "../../generated/avro/dto/MessageStatusEnum";
import { MessageFormatter } from "../kafka/KafkaTypes";

const formatStatus = (
  status: NotRejectedMessageStatusValueEnum | RejectedMessageStatusValueEnum
): AvroMessageStatus => AvroMessageStatus[status];

export const buildAvroServiceObject = (
  retrievedMessageStatus: RetrievedMessageStatus
): Omit<messageStatus, "schema" | "subject"> => ({
  id: retrievedMessageStatus.id,
  isArchived: retrievedMessageStatus.isArchived,
  isRead: retrievedMessageStatus.isRead,
  messageId: retrievedMessageStatus.messageId,
  op:
    retrievedMessageStatus.version === 0
      ? CrudOperation.CREATE
      : CrudOperation.UPDATE,
  status: formatStatus(retrievedMessageStatus.status),

  timestamp: retrievedMessageStatus._ts * 1000,
  updatedAt: retrievedMessageStatus.updatedAt.getTime(),
  version: retrievedMessageStatus.version
});

export const messageStatusAvroFormatter =
  (): MessageFormatter<RetrievedMessageStatus> => (message) => ({
    // messageId as Partition Key
    key: message.messageId,
    value: avro.Type.forSchema(
      messageStatus.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
    ).toBuffer(
      Object.assign(new messageStatus(), buildAvroServiceObject(message))
    )
  });
