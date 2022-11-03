import { Context } from "@azure/functions";
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
import * as EA from "../outbound/adapter/throw-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import * as MA from "../outbound/adapter/messages-outbound-enricher";
import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import {
  avroMessageFormatter,
  ThirdPartyDataWithCategoryFetcher
} from "../utils/formatter/messagesAvroFormatter";
import { MessageContentType } from "../generated/avro/dto/MessageContentTypeEnum";
import { cosmosdbInstance } from "../utils/cosmosdb";

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
  createBlobService(config.MessageContentPrimaryStorageConnection)
);

const throwAdapter: OutboundPublisher<RetrievedMessage> = EA.create();

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPINSIGHTS_INSTRUMENTATIONKEY)
);

const run = (
  _context: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedMessage,
    telemetryAdapter,
    messageEnricherAdapter,
    retrievedMessagesOnKafkaAdapter,
    throwAdapter
  ).process([documents])();

export default run;
