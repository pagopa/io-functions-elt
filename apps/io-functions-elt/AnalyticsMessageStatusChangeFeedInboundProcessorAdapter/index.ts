import { Context } from "@azure/functions";
import { RetrievedMessageStatus } from "@pagopa/io-functions-commons/dist/src/models/message_status";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import * as EEA from "../outbound/adapter/empty-outbound-enricher";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as PF from "../outbound/adapter/predicate-outbound-filterer";
import * as QA from "../outbound/adapter/queue-outbound-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { OutboundFilterer } from "../outbound/port/outbound-filterer";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { createQueueClientWithManagedIdentity } from "../utils/azure-identity";
import { getConfigOrThrow, withTopic } from "../utils/config";
import { messageStatusAvroFormatter } from "../utils/formatter/messageStatusAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { isTestUser } from "../utils/testUser";

const config = getConfigOrThrow();

const messageStatusConfig = withTopic(
  config.messageStatusKafkaTopicConfig.MESSAGE_STATUS_TOPIC_NAME,
  config.messageStatusKafkaTopicConfig.MESSAGE_STATUS_TOPIC_CONNECTION_STRING
)(config.targetKafka);
const messageStatusTopic = {
  ...messageStatusConfig,
  messageFormatter: messageStatusAvroFormatter()
};
const messageStatusOnKafkaAdapter: OutboundPublisher<RetrievedMessageStatus> =
  KA.create(
    KP.fromConfig(
      messageStatusConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
      messageStatusTopic
    )
  );

const messageStatusOnQueueAdapter: OutboundPublisher<RetrievedMessageStatus> =
  QA.create(
    createQueueClientWithManagedIdentity(
      config.INTERNAL_STORAGE_ACCOUNT,
      config.MESSAGE_STATUS_FAILURE_QUEUE_NAME
    )
  );

const telemetryAdapter = TA.create(
  TA.initTelemetryClient(config.APPLICATIONINSIGHTS_CONNECTION_STRING)
);

const internalTestFiscalCodeSet = new Set(
  config.INTERNAL_TEST_FISCAL_CODES_COMPRESSED as readonly FiscalCode[]
);

const messageStatusFilterer: OutboundFilterer<RetrievedMessageStatus> =
  PF.create(
    (retrievedMessageStatus) =>
      !(
        retrievedMessageStatus.fiscalCode !== undefined &&
        isTestUser(retrievedMessageStatus.fiscalCode, internalTestFiscalCodeSet)
      )
  );
const emptyEnricherAdapter: OutboundEnricher<RetrievedMessageStatus> =
  EEA.create();

const run = (_context: Context, documents: readonly unknown[]): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedMessageStatus,
    telemetryAdapter,
    emptyEnricherAdapter,
    messageStatusOnKafkaAdapter,
    messageStatusOnQueueAdapter,
    messageStatusFilterer
  ).process(documents)();

export default run;
