/**
 * Service Preferences domain — shared adapters.
 *
 * Kafka publisher, queue fallback publisher, PDV enricher,
 * test-user filterer, and empty throw adapter for queue retries.
 */

import { QueueClient } from "@azure/storage-queue";
import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { Second } from "@pagopa/ts-commons/lib/units";

import * as EA from "../outbound/adapter/empty-outbound-publisher";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as PDVA from "../outbound/adapter/pdv-id-outbound-enricher";
import * as PF from "../outbound/adapter/predicate-outbound-filterer";
import * as QA from "../outbound/adapter/queue-outbound-mapper-publisher";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { OutboundFilterer } from "../outbound/port/outbound-filterer";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { withTopic } from "../utils/config";
import { servicePreferencesAvroFormatter } from "../utils/formatter/servicePreferencesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { isTestUser } from "../utils/testUser";
import { RetrievedServicePreferenceWithMaybePdvId } from "../utils/types/decoratedTypes";
import {
  config,
  internalTestFiscalCodeSet,
  pdvTokenizer,
  redisClientTask,
  telemetryClient
} from "./cross-cutting";

// ---------------------------------------------------------------------------
// KAFKA & QUEUE PUBLISHERS
// ---------------------------------------------------------------------------
const servicePreferencesConfig = withTopic(
  config.servicePreferencesKafkaTopicConfig.SERVICE_PREFERENCES_TOPIC_NAME,
  config.servicePreferencesKafkaTopicConfig
    .SERVICE_PREFERENCES_TOPIC_CONNECTION_STRING
)(config.targetKafkaAuth);

const servicePreferencesTopic = {
  ...servicePreferencesConfig,
  messageFormatter: servicePreferencesAvroFormatter()
};

export const servicePreferencesOnKafkaAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> =
  KA.create(
    KP.fromConfig(
      servicePreferencesConfig as ValidableKafkaProducerConfig,
      servicePreferencesTopic
    )
  );

export const servicePreferencesOnQueueAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> =
  QA.create(
    (servicePreference) => {
      // void storing userPDVId in queue
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userPDVId, ...rest } = servicePreference;
      return rest;
    },
    new QueueClient(
      config.BLOB_COMMAND_STORAGE,
      config.SERVICE_PREFERENCES_FAILURE_QUEUE_NAME
    )
  );

// ---------------------------------------------------------------------------
// PDV ENRICHER
// ---------------------------------------------------------------------------
export const servicePreferencesPdvIdEnricherAdapter: OutboundEnricher<RetrievedServicePreferenceWithMaybePdvId> =
  PDVA.create<RetrievedServicePreferenceWithMaybePdvId>(
    config.ENRICH_PDVID_THROTTLING,
    pdvTokenizer,
    redisClientTask,
    config.PDV_IDS_TTL as Second,
    telemetryClient
  );

// ---------------------------------------------------------------------------
// FILTERER
// ---------------------------------------------------------------------------
export const servicePreferencesFilterer: OutboundFilterer<RetrievedServicePreference> =
  PF.create(
    (retrievedServicePreference) =>
      !isTestUser(
        retrievedServicePreference.fiscalCode,
        internalTestFiscalCodeSet
      )
  );

// ---------------------------------------------------------------------------
// THROW ADAPTER (queue retry fallback)
// ---------------------------------------------------------------------------
export const servicePreferencesThrowAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> =
  EA.create();
