/**
 * Services domain — shared adapters.
 *
 * Kafka publisher, queue fallback publisher, empty enricher,
 * and empty throw adapter for queue retries.
 */

import { QueueClient } from "@azure/storage-queue";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";

import * as EEA from "../outbound/adapter/empty-outbound-enricher";
import * as EA from "../outbound/adapter/empty-outbound-publisher";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as QPA from "../outbound/adapter/queue-outbound-publisher";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { avroServiceFormatter } from "../utils/formatter/servicesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { config } from "./cross-cutting";

// ---------------------------------------------------------------------------
// KAFKA & QUEUE PUBLISHERS
// ---------------------------------------------------------------------------
const servicesTopic = {
  ...config.targetKafka,
  messageFormatter: avroServiceFormatter(config.SERVICEID_EXCLUSION_LIST)
};

export const retrievedServiceOnKafkaAdapter: OutboundPublisher<RetrievedService> =
  KA.create(
    KP.fromConfig(servicesTopic as ValidableKafkaProducerConfig, servicesTopic)
  );

export const retrievedServiceOnQueueAdapter: OutboundPublisher<RetrievedService> =
  QPA.create(
    new QueueClient(
      config.BLOB_COMMAND_STORAGE,
      config.SERVICES_FAILURE_QUEUE_NAME
    )
  );

// ---------------------------------------------------------------------------
// ENRICHER (no-op for services)
// ---------------------------------------------------------------------------
export const emptyServiceEnricherAdapter: OutboundEnricher<RetrievedService> =
  EEA.create();

// ---------------------------------------------------------------------------
// THROW ADAPTER (queue retry fallback)
// ---------------------------------------------------------------------------
export const serviceThrowAdapter: OutboundPublisher<RetrievedService> =
  EA.create();
