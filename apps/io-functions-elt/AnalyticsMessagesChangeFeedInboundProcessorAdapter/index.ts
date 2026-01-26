import { Context } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";
import {
  MESSAGE_COLLECTION_NAME,
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { createBlobService } from "azure-storage";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";

import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import { MessageContentType } from "../generated/avro/dto/MessageContentTypeEnum";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as MA from "../outbound/adapter/messages-outbound-enricher";
import * as PF from "../outbound/adapter/predicate-outbound-filterer";
import * as QA from "../outbound/adapter/queue-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import { OutboundFilterer } from "../outbound/port/outbound-filterer";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { getConfigOrThrow } from "../utils/config";
import { cosmosdbInstance } from "../utils/cosmosdb";
import {
  avroMessageFormatter,
  ThirdPartyDataWithCategoryFetcher
} from "../utils/formatter/messagesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { isTestUser } from "../utils/testUser";

const config = getConfigOrThrow();

const messagesConfig = {
  ...config.targetKafka,
  sasl: {
    ...config.targetKafka.sasl,
    password: config.MessagesKafkaTopicConfig.MESSAGES_TOPIC_CONNECTION_STRING
  },
  topic: config.MessagesKafkaTopicConfig.MESSAGES_TOPIC_NAME
};
const thirdPartyDataWithCategoryFetcher: ThirdPartyDataWithCategoryFetcher = (
  serviceId
) =>
  pipe(
    serviceId,
    E.fromPredicate(
      (id) => id === config.PN_SERVICE_ID,
      (id) => Error(`Missing third-party service configuration for ${id}`)
    ),
    E.map(() => MessageContentType.PN),
    E.mapLeft(() => MessageContentType.GENERIC),
    E.toUnion
  );
const messagesTopic = {
  ...messagesConfig,
  messageFormatter: avroMessageFormatter(thirdPartyDataWithCategoryFetcher)
};
const retrievedMessagesOnKafkaAdapter: OutboundPublisher<RetrievedMessage> =
  KA.create(
    KP.fromConfig(
      messagesTopic as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
      messagesTopic
    )
  );

const messageEnricherAdapter = MA.create(
  new MessageModel(
    cosmosdbInstance.container(MESSAGE_COLLECTION_NAME),
    "message-content" as NonEmptyString
  ),
  createBlobService(config.MessageContentPrimaryStorageConnection),
  config.ENRICH_MESSAGE_THROTTLING
);

const retrievedMessageOnQueueAdapter: OutboundPublisher<RetrievedMessage> =
  QA.create(
    new QueueClient(
      config.BLOB_COMMAND_STORAGE,
      config.MESSAGES_FAILURE_QUEUE_NAME
    )
  );

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPLICATIONINSIGHTS_CONNECTION_STRING)
);

const internalTestFiscalCodeSet = new Set(
  config.INTERNAL_TEST_FISCAL_CODES_COMPRESSED as readonly FiscalCode[]
);

const messageFilterer: OutboundFilterer<RetrievedMessage> = PF.create(
  (retrievedMessage) =>
    !isTestUser(retrievedMessage.fiscalCode, internalTestFiscalCodeSet)
);

const run = (_context: Context, documents: readonly unknown[]): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedMessage,
    telemetryAdapter,
    messageEnricherAdapter,
    retrievedMessagesOnKafkaAdapter,
    retrievedMessageOnQueueAdapter,
    messageFilterer
  ).process(documents)();

export default run;
