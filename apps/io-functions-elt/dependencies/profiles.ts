/**
 * Profiles domain — shared adapters.
 *
 * Kafka publisher, queue fallback publisher, PDV enricher,
 * test-user filterer, and empty throw adapter for queue retries.
 */

import { QueueClient } from "@azure/storage-queue";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
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
import { profilesAvroFormatter } from "../utils/formatter/profilesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { isTestUser } from "../utils/testUser";
import { RetrievedProfileWithMaybePdvId } from "../utils/types/decoratedTypes";
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
const profilesConfig = withTopic(
  config.profilesKafkaTopicConfig.PROFILES_TOPIC_NAME,
  config.profilesKafkaTopicConfig.PROFILES_TOPIC_CONNECTION_STRING
)(config.targetKafkaAuth);

const profilesTopic = {
  ...profilesConfig,
  messageFormatter: profilesAvroFormatter()
};

export const profilesOnKafkaAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> =
  KA.create(
    KP.fromConfig(profilesConfig as ValidableKafkaProducerConfig, profilesTopic)
  );

export const profilesOnQueueAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> =
  QA.create(
    (profile) => {
      // void storing userPDVId in queue
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userPDVId, ...rest } = profile;
      return rest;
    },
    new QueueClient(
      config.BLOB_COMMAND_STORAGE,
      config.PROFILES_FAILURE_QUEUE_NAME
    )
  );

// ---------------------------------------------------------------------------
// PDV ENRICHER
// ---------------------------------------------------------------------------
export const profilePdvIdEnricherAdapter: OutboundEnricher<RetrievedProfileWithMaybePdvId> =
  PDVA.create<RetrievedProfileWithMaybePdvId>(
    config.ENRICH_PDVID_THROTTLING,
    pdvTokenizer,
    redisClientTask,
    config.PDV_IDS_TTL as Second,
    telemetryClient
  );

// ---------------------------------------------------------------------------
// FILTERER
// ---------------------------------------------------------------------------
export const profilesFilterer: OutboundFilterer<RetrievedProfile> = PF.create(
  (retrievedProfile) =>
    !isTestUser(retrievedProfile.fiscalCode, internalTestFiscalCodeSet)
);

// ---------------------------------------------------------------------------
// THROW ADAPTER (queue retry fallback)
// ---------------------------------------------------------------------------
export const profileThrowAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> =
  EA.create();
