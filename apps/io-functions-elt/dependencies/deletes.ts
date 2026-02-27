/**
 * User Data Processing / Deletes domain — shared adapters.
 *
 * Kafka publisher, queue fallback publisher, PDV enricher,
 * combined test-user + status filterer, and empty throw adapter
 * for queue retries.
 */

import { QueueClient } from "@azure/storage-queue";
import { UserDataProcessingChoiceEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import { RetrievedUserDataProcessing } from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
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
import { profileDeletionAvroFormatter } from "../utils/formatter/deletesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { isTestUser } from "../utils/testUser";
import { RetrievedUserDataProcessingWithMaybePdvId } from "../utils/types/decoratedTypes";
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
const profileDeletionConfig = withTopic(
  config.deletesKafkaTopicConfig.DELETES_TOPIC_NAME,
  config.deletesKafkaTopicConfig.DELETES_TOPIC_CONNECTION_STRING
)(config.targetKafkaAuth);

const profileDeletionTopic = {
  ...profileDeletionConfig,
  messageFormatter: profileDeletionAvroFormatter()
};

export const profileDeletionsOnKafkaAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> =
  KA.create(
    KP.fromConfig(
      profileDeletionConfig as ValidableKafkaProducerConfig,
      profileDeletionTopic
    )
  );

export const profileDeletionsOnQueueAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> =
  QA.create(
    (profileDeletion) => {
      // void storing userPDVId in queue
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userPDVId, ...rest } = profileDeletion;
      return rest;
    },
    new QueueClient(
      config.BLOB_COMMAND_STORAGE,
      config.DELETES_FAILURE_QUEUE_NAME
    )
  );

// ---------------------------------------------------------------------------
// PDV ENRICHER
// ---------------------------------------------------------------------------
export const deletionsPdvIdEnricherAdapter: OutboundEnricher<RetrievedUserDataProcessingWithMaybePdvId> =
  PDVA.create<RetrievedUserDataProcessingWithMaybePdvId>(
    config.ENRICH_PDVID_THROTTLING,
    pdvTokenizer,
    redisClientTask,
    config.PDV_IDS_TTL as Second,
    telemetryClient
  );

// ---------------------------------------------------------------------------
// FILTERER
// ---------------------------------------------------------------------------
export const userDataProcessingFilterer: OutboundFilterer<RetrievedUserDataProcessing> =
  PF.create(
    (retrievedUserDataProcessing) =>
      !isTestUser(
        retrievedUserDataProcessing.fiscalCode,
        internalTestFiscalCodeSet
      ) &&
      retrievedUserDataProcessing.choice ===
        UserDataProcessingChoiceEnum.DELETE &&
      retrievedUserDataProcessing.status === UserDataProcessingStatusEnum.WIP
  );

// ---------------------------------------------------------------------------
// THROW ADAPTER (queue retry fallback)
// ---------------------------------------------------------------------------
export const deletionsThrowAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> =
  EA.create();
