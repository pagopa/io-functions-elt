import { Context } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import {
  MessageModel,
  MESSAGE_COLLECTION_NAME,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { createBlobService } from "azure-storage";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { getConfigOrThrow } from "../utils/config";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as QA from "../outbound/adapter/queue-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import * as MA from "../outbound/adapter/messages-outbound-enricher";
import * as PF from "../outbound/adapter/predicate-outbound-filterer";
import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import {
  avroMessageFormatter,
  ThirdPartyDataWithCategoryFetcher
} from "../utils/formatter/messagesAvroFormatter";
import { MessageContentType } from "../generated/avro/dto/MessageContentTypeEnum";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { OutboundFilterer } from "../outbound/port/outbound-filterer";
import * as CAE from "../outbound/adapter/combine-outbound-enricher";
import * as PDVEA from "../outbound/adapter/personaldatavault-outbound-enricher";
import { RetrievedMessageWithToken } from "../utils/types/retrievedMessageWithToken";
import { personalDataVaultClient } from "../clients/personalDataValult";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";

const config = getConfigOrThrow();

const messagesConfig = {
  ...config.targetKafka,
  sasl: {
    ...config.targetKafka.sasl,
    password: config.MessagesKafkaTopicConfig.MESSAGES_TOPIC_CONNECTION_STRING
  },
  topic: config.MessagesKafkaTopicConfig.MESSAGES_TOPIC_NAME
};
const thirdPartyDataWithCategoryFetcher: ThirdPartyDataWithCategoryFetcher = serviceId =>
  pipe(
    serviceId,
    E.fromPredicate(
      id => id === config.PN_SERVICE_ID,
      id => Error(`Missing third-party service configuration for ${id}`)
    ),
    E.map(() => MessageContentType.PN),
    E.mapLeft(() => MessageContentType.GENERIC),
    E.toUnion
  );
const messagesTopic = {
  ...messagesConfig,
  messageFormatter: avroMessageFormatter(thirdPartyDataWithCategoryFetcher)
};
const retrievedMessagesOnKafkaAdapter: OutboundPublisher<RetrievedMessage> = KA.create(
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
)
const personalDataVaultEnricherAdapter: OutboundEnricher<RetrievedMessageWithToken> = PDVEA.create(
  personalDataVaultClient
);
const messageEnricherWithTokenAdapater = CAE.create(
  messageEnricherAdapter,
  personalDataVaultEnricherAdapter
);

const retrievedMessageOnQueueAdapter: OutboundPublisher<RetrievedMessage> = QA.create(
  new QueueClient(
    config.INTERNAL_STORAGE_CONNECTION_STRING,
    config.MESSAGES_FAILURE_QUEUE_NAME
  )
);

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPINSIGHTS_INSTRUMENTATIONKEY)
);

const messageFilterer: OutboundFilterer<RetrievedMessage> = PF.create(
  retrievedMessage =>
    !config.INTERNAL_TEST_FISCAL_CODES.includes(retrievedMessage.fiscalCode)
);

const run = (
  _context: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedMessageWithToken,
    telemetryAdapter,
    messageEnricherWithTokenAdapater,
    retrievedMessagesOnKafkaAdapter,
    retrievedMessageOnQueueAdapter,
    messageFilterer
  ).process(documents)();

export default run;
