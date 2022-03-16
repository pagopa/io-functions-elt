/* eslint-disable @typescript-eslint/naming-convention */
import * as avro from "avsc";

import { RetrievedNotificationStatus } from "@pagopa/io-functions-commons/dist/src/models/notification_status";
import { NotificationChannelStatusValueEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/NotificationChannelStatusValue";
import { NotificationChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/NotificationChannel";

import { MessageFormatter } from "../kafka/KafkaTypes";
import { notificationStatus } from "../../generated/avro/dto/notificationStatus";
import { MessageNotificationStatus } from "../../generated/avro/dto/MessageNotificationStatusEnum";
import { ChannelType } from "../../generated/avro/dto/ChannelTypeEnum";
import { NotificationStatusCrudOperation } from "../../generated/avro/dto/NotificationStatusCrudOperationEnum";

const toAvroNotificationStatus = (
  status: NotificationChannelStatusValueEnum
): MessageNotificationStatus => MessageNotificationStatus[status];

const toAvroChannel = (status: NotificationChannelEnum): ChannelType =>
  ChannelType[status];

export const buildAvroNotificationStatusObject = (
  retrievedNotificationStatus: RetrievedNotificationStatus
): Omit<notificationStatus, "schema" | "subject"> =>
  // eslint-disable-next-line no-console, no-underscore-dangle
  ({
    op:
      retrievedNotificationStatus.version === 0
        ? NotificationStatusCrudOperation.CREATE
        : NotificationStatusCrudOperation.UPDATE,
    /* eslint-disable sort-keys, no-underscore-dangle */
    id: retrievedNotificationStatus.id,
    messageId: retrievedNotificationStatus.messageId,
    notificationId: retrievedNotificationStatus.notificationId,
    channel: toAvroChannel(retrievedNotificationStatus.channel),
    status: toAvroNotificationStatus(retrievedNotificationStatus.status),
    statusId: retrievedNotificationStatus.statusId,
    updatedAt: Math.trunc(
      retrievedNotificationStatus.updatedAt.getTime() / 1000
    ),
    version: retrievedNotificationStatus.version,
    timestamp: retrievedNotificationStatus._ts
    /* eslint-enable sort-keys */
  });

export const avroNotificationStatusFormatter = (): // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
MessageFormatter<RetrievedNotificationStatus> => message => ({
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
