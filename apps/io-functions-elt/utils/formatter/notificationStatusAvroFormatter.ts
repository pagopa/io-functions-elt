import { NotificationChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/NotificationChannelStatusValue";
import { RetrievedNotificationStatus } from "@pagopa/io-functions-commons/dist/src/models/notification_status";
import * as avro from "avsc";

import { ChannelType } from "../../generated/avro/dto/ChannelTypeEnum";
import { MessageNotificationStatus } from "../../generated/avro/dto/MessageNotificationStatusEnum";
import { notificationStatus } from "../../generated/avro/dto/notificationStatus";
import { NotificationStatusCrudOperation } from "../../generated/avro/dto/NotificationStatusCrudOperationEnum";
import { MessageFormatter } from "../kafka/KafkaTypes";

const toAvroNotificationStatus = (
  status: NotificationChannelStatusValueEnum
): MessageNotificationStatus => MessageNotificationStatus[status];

const toAvroChannel = (status: NotificationChannelEnum): ChannelType =>
  ChannelType[status];

export const buildAvroNotificationStatusObject = (
  retrievedNotificationStatus: RetrievedNotificationStatus
): Omit<notificationStatus, "schema" | "subject"> => ({
  channel: toAvroChannel(retrievedNotificationStatus.channel),

  id: retrievedNotificationStatus.id,
  messageId: retrievedNotificationStatus.messageId,
  notificationId: retrievedNotificationStatus.notificationId,
  op:
    retrievedNotificationStatus.version === 0
      ? NotificationStatusCrudOperation.CREATE
      : NotificationStatusCrudOperation.UPDATE,
  status: toAvroNotificationStatus(retrievedNotificationStatus.status),
  statusId: retrievedNotificationStatus.statusId,
  timestamp: retrievedNotificationStatus._ts * 1000,
  updatedAt: retrievedNotificationStatus.updatedAt.getTime(),
  version: retrievedNotificationStatus.version
});

export const avroNotificationStatusFormatter =
  (): MessageFormatter<RetrievedNotificationStatus> => (message) => ({
    // notificatioId as Partition Key
    key: message.notificationId,
    value: avro.Type.forSchema(
      notificationStatus.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
    ).toBuffer(
      Object.assign(
        new notificationStatus(),
        buildAvroNotificationStatusObject(message)
      )
    )
  });
