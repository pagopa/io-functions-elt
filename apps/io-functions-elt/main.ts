/**
 * Azure Functions v4 entry point — main.ts
 *
 * Replaces all per-function index.ts entry points.
 */

import { app } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";
import { UserDataProcessingChoiceEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { RetrievedUserDataProcessing } from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";

import { getAnalyticsProcessorForDocuments } from "./businesslogic/analytics-publish-documents";
import { Info } from "./Info/handler";
import * as EEA from "./outbound/adapter/empty-outbound-enricher";
import * as EA from "./outbound/adapter/empty-outbound-publisher";
import * as KA from "./outbound/adapter/kafka-outbound-publisher";
import * as PDVA from "./outbound/adapter/pdv-id-outbound-enricher";
import * as PF from "./outbound/adapter/predicate-outbound-filterer";
import * as QA from "./outbound/adapter/queue-outbound-mapper-publisher";
import * as QPA from "./outbound/adapter/queue-outbound-publisher";
import * as TA from "./outbound/adapter/tracker-outbound-publisher";
import { OutboundEnricher } from "./outbound/port/outbound-enricher";
import { OutboundFilterer } from "./outbound/port/outbound-filterer";
import { OutboundPublisher } from "./outbound/port/outbound-publisher";
import { getConfigOrThrow, withTopic } from "./utils/config";
import { httpOrHttpsApiFetch } from "./utils/fetch";
import { profileDeletionAvroFormatter } from "./utils/formatter/deletesAvroFormatter";
import { profilesAvroFormatter } from "./utils/formatter/profilesAvroFormatter";
import { servicePreferencesAvroFormatter } from "./utils/formatter/servicePreferencesAvroFormatter";
import { avroServiceFormatter } from "./utils/formatter/servicesAvroFormatter";
import * as KP from "./utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "./utils/kafka/KafkaTypes";
import { pdvTokenizerClient } from "./utils/pdvTokenizerClient";
import { createRedisClientSingleton } from "./utils/redis";
import { isTestUser } from "./utils/testUser";
import {
  RetrievedProfileWithMaybePdvId,
  RetrievedServicePreferenceWithMaybePdvId,
  RetrievedUserDataProcessingWithMaybePdvId
} from "./utils/types/decoratedTypes";

// ---------------------------------------------------------------------------
// CONFIG SETUP
// ---------------------------------------------------------------------------
const config = getConfigOrThrow();

// ---------------------------------------------------------------------------
// SHARED DEPENDENCIES — PROFILES
// ---------------------------------------------------------------------------
const profilesConfig = withTopic(
  config.profilesKafkaTopicConfig.PROFILES_TOPIC_NAME,
  config.profilesKafkaTopicConfig.PROFILES_TOPIC_CONNECTION_STRING
)(config.targetKafkaAuth);

const profilesTopic = {
  ...profilesConfig,
  messageFormatter: profilesAvroFormatter()
};

const profilesOnKafkaAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> =
  KA.create(
    KP.fromConfig(profilesConfig as ValidableKafkaProducerConfig, profilesTopic)
  );

const profilesOnQueueAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> =
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
// SHARED DEPENDENCIES — SERVICES
// ---------------------------------------------------------------------------
const servicesTopic = {
  ...config.targetKafka,
  messageFormatter: avroServiceFormatter(config.SERVICEID_EXCLUSION_LIST)
};

const retrievedServiceOnKafkaAdapter: OutboundPublisher<RetrievedService> =
  KA.create(
    KP.fromConfig(servicesTopic as ValidableKafkaProducerConfig, servicesTopic)
  );

const retrievedServiceOnQueueAdapter: OutboundPublisher<RetrievedService> =
  QPA.create(
    new QueueClient(
      config.BLOB_COMMAND_STORAGE,
      config.SERVICES_FAILURE_QUEUE_NAME
    )
  );

// ---------------------------------------------------------------------------
// SHARED DEPENDENCIES — SERVICE PREFERENCES
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

const servicePreferencesOnKafkaAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> =
  KA.create(
    KP.fromConfig(
      servicePreferencesConfig as ValidableKafkaProducerConfig,
      servicePreferencesTopic
    )
  );

const servicePreferencesOnQueueAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> =
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
// SHARED DEPENDENCIES — USER DATA PROCESSING (DELETES)
// ---------------------------------------------------------------------------
const profileDeletionConfig = withTopic(
  config.deletesKafkaTopicConfig.DELETES_TOPIC_NAME,
  config.deletesKafkaTopicConfig.DELETES_TOPIC_CONNECTION_STRING
)(config.targetKafkaAuth);

const profileDeletionTopic = {
  ...profileDeletionConfig,
  messageFormatter: profileDeletionAvroFormatter()
};

const profileDeletionsOnKafkaAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> =
  KA.create(
    KP.fromConfig(
      profileDeletionConfig as ValidableKafkaProducerConfig,
      profileDeletionTopic
    )
  );

const profileDeletionsOnQueueAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> =
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
// SHARED DEPENDENCIES — PDV TOKENIZER, REDIS, TELEMETRY
// ---------------------------------------------------------------------------
const pdvTokenizer = pdvTokenizerClient(
  config.PDV_TOKENIZER_BASE_URL,
  config.PDV_TOKENIZER_API_KEY,
  httpOrHttpsApiFetch,
  config.PDV_TOKENIZER_BASE_PATH
);

const redisClientTask = createRedisClientSingleton(config);

const telemetryClient = TA.initTelemetryClient(
  config.APPLICATIONINSIGHTS_CONNECTION_STRING
);

const telemetryAdapter = TA.create(telemetryClient);

// ---------------------------------------------------------------------------
// SHARED DEPENDENCIES — PDV ID ENRICHERS
// ---------------------------------------------------------------------------
const profilePdvIdEnricherAdapter: OutboundEnricher<RetrievedProfileWithMaybePdvId> =
  PDVA.create<RetrievedProfileWithMaybePdvId>(
    config.ENRICH_PDVID_THROTTLING,
    pdvTokenizer,
    redisClientTask,
    config.PDV_IDS_TTL as Second,
    telemetryClient
  );

const servicePreferencesPdvIdEnricherAdapter: OutboundEnricher<RetrievedServicePreferenceWithMaybePdvId> =
  PDVA.create<RetrievedServicePreferenceWithMaybePdvId>(
    config.ENRICH_PDVID_THROTTLING,
    pdvTokenizer,
    redisClientTask,
    config.PDV_IDS_TTL as Second,
    telemetryClient
  );

const deletionsPdvIdEnricherAdapter: OutboundEnricher<RetrievedUserDataProcessingWithMaybePdvId> =
  PDVA.create<RetrievedUserDataProcessingWithMaybePdvId>(
    config.ENRICH_PDVID_THROTTLING,
    pdvTokenizer,
    redisClientTask,
    config.PDV_IDS_TTL as Second,
    telemetryClient
  );

const emptyServiceEnricherAdapter: OutboundEnricher<RetrievedService> =
  EEA.create();

// ---------------------------------------------------------------------------
// SHARED DEPENDENCIES — FILTERERS
// ---------------------------------------------------------------------------
const internalTestFiscalCodeSet = new Set(
  config.INTERNAL_TEST_FISCAL_CODES_COMPRESSED as readonly FiscalCode[]
);

const profilesFilterer: OutboundFilterer<RetrievedProfile> = PF.create(
  (retrievedProfile) =>
    !isTestUser(retrievedProfile.fiscalCode, internalTestFiscalCodeSet)
);

const servicePreferencesFilterer: OutboundFilterer<RetrievedServicePreference> =
  PF.create(
    (retrievedServicePreference) =>
      !isTestUser(
        retrievedServicePreference.fiscalCode,
        internalTestFiscalCodeSet
      )
  );

const userDataProcessingFilterer: OutboundFilterer<RetrievedUserDataProcessing> =
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
// THROW / EMPTY ADAPTERS (used by queue-based retry functions)
// ---------------------------------------------------------------------------
const profileThrowAdapter: OutboundPublisher<RetrievedProfileWithMaybePdvId> =
  EA.create();
const serviceThrowAdapter: OutboundPublisher<RetrievedService> = EA.create();
const servicePreferencesThrowAdapter: OutboundPublisher<RetrievedServicePreferenceWithMaybePdvId> =
  EA.create();
const deletionsThrowAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> =
  EA.create();

// ---------------------------------------------------------------------------
// HTTP TRIGGERS
// ---------------------------------------------------------------------------
app.http("Info", {
  authLevel: "anonymous",
  handler: Info(),
  methods: ["GET"],
  route: "v1/info"
});

// ---------------------------------------------------------------------------
// COSMOSDB TRIGGERS (CHANGE FEED)
// ---------------------------------------------------------------------------

// Profiles change feed
app.cosmosDB("AnalyticsProfilesChangeFeedInboundProcessorAdapter", {
  connection: "COSMOS_API_CONNECTION_STRING",
  containerName: "profiles",
  createLeaseContainerIfNotExists: false,
  databaseName: "%COSMOSDB_NAME%",
  handler: (documents: unknown[]): Promise<void> =>
    getAnalyticsProcessorForDocuments(
      RetrievedProfile,
      telemetryAdapter,
      profilePdvIdEnricherAdapter,
      profilesOnKafkaAdapter,
      profilesOnQueueAdapter,
      profilesFilterer
    ).process(documents)(),
  leaseContainerName: "pdnd-leases",
  leaseContainerPrefix: "%PROFILES_LEASES_PREFIX%-",
  startFromBeginning: true
});

// Services change feed (with retry)
app.cosmosDB("AnalyticsServiceChangeFeedInboundProcessorAdapter", {
  connection: "COSMOS_API_CONNECTION_STRING",
  containerName: "services",
  createLeaseContainerIfNotExists: true,
  databaseName: "%COSMOSDB_NAME%",
  handler: (documents: unknown[]): Promise<void> =>
    getAnalyticsProcessorForDocuments(
      RetrievedService,
      telemetryAdapter,
      emptyServiceEnricherAdapter,
      retrievedServiceOnKafkaAdapter,
      retrievedServiceOnQueueAdapter
    ).process(documents)(),
  leaseContainerName: "pdnd-leases",
  leaseContainerPrefix: "%SERVICES_LEASES_PREFIX%-",
  retry: {
    maximumInterval: { minutes: 30 },
    maxRetryCount: -1,
    minimumInterval: { seconds: 5 },
    strategy: "exponentialBackoff"
  },
  startFromBeginning: true
});

// Service preferences change feed
app.cosmosDB("AnalyticsServicePreferencesChangeFeedInboundProcessorAdapter", {
  connection: "COSMOS_API_CONNECTION_STRING",
  containerName: "services-preferences",
  createLeaseContainerIfNotExists: false,
  databaseName: "%COSMOSDB_NAME%",
  handler: (documents: unknown[]): Promise<void> =>
    getAnalyticsProcessorForDocuments(
      RetrievedServicePreference,
      telemetryAdapter,
      servicePreferencesPdvIdEnricherAdapter,
      servicePreferencesOnKafkaAdapter,
      servicePreferencesOnQueueAdapter,
      servicePreferencesFilterer
    ).process(documents)(),
  leaseContainerName: "pdnd-leases",
  leaseContainerPrefix: "%SERVICE_PREFERENCES_LEASES_PREFIX%-",
  startFromBeginning: true
});

// User data processing change feed
app.cosmosDB("AnalyticsUserDataProcessingChangeFeedInboundProcessorAdapter", {
  connection: "COSMOS_API_CONNECTION_STRING",
  containerName: "user-data-processing",
  createLeaseContainerIfNotExists: false,
  databaseName: "%COSMOSDB_NAME%",
  handler: (documents: unknown[]): Promise<void> =>
    getAnalyticsProcessorForDocuments(
      RetrievedUserDataProcessing,
      telemetryAdapter,
      deletionsPdvIdEnricherAdapter,
      profileDeletionsOnKafkaAdapter,
      profileDeletionsOnQueueAdapter,
      userDataProcessingFilterer
    ).process(documents)(),
  leaseContainerName: "pdnd-leases",
  leaseContainerPrefix: "%DELETES_LEASES_PREFIX%-",
  startFromBeginning: false
});

// ---------------------------------------------------------------------------
// QUEUE TRIGGERS
// Retry policy is handled by host.json extensions.queues (binding-level retry)
// ---------------------------------------------------------------------------

// Profiles failure queue
app.storageQueue("AnalyticsProfileStorageQueueInboundProcessorAdapter", {
  connection: "BLOB_COMMAND_STORAGE",
  handler: (queueItem: unknown): Promise<void> =>
    getAnalyticsProcessorForDocuments(
      RetrievedProfile,
      telemetryAdapter,
      profilePdvIdEnricherAdapter,
      profilesOnKafkaAdapter,
      profileThrowAdapter
    ).process([queueItem])(),
  queueName: "%PROFILES_FAILURE_QUEUE_NAME%"
});

// Services failure queue
app.storageQueue("AnalyticsServiceStorageQueueInboundProcessorAdapter", {
  connection: "BLOB_COMMAND_STORAGE",
  handler: (queueItem: unknown): Promise<void> =>
    getAnalyticsProcessorForDocuments(
      RetrievedService,
      telemetryAdapter,
      emptyServiceEnricherAdapter,
      retrievedServiceOnKafkaAdapter,
      serviceThrowAdapter
    ).process([queueItem])(),
  queueName: "%SERVICES_FAILURE_QUEUE_NAME%"
});

// Service preferences failure queue
app.storageQueue(
  "AnalyticsServicePreferencesStorageQueueInboundProcessorAdapter",
  {
    connection: "BLOB_COMMAND_STORAGE",
    handler: (queueItem: unknown): Promise<void> =>
      getAnalyticsProcessorForDocuments(
        RetrievedServicePreference,
        telemetryAdapter,
        servicePreferencesPdvIdEnricherAdapter,
        servicePreferencesOnKafkaAdapter,
        servicePreferencesThrowAdapter
      ).process([queueItem])(),
    queueName: "%SERVICE_PREFERENCES_FAILURE_QUEUE_NAME%"
  }
);

// User data processing (deletes) failure queue
app.storageQueue(
  "AnalyticsUserDataProcessingStorageQueueInboundProcessorAdapter",
  {
    connection: "BLOB_COMMAND_STORAGE",
    handler: (queueItem: unknown): Promise<void> =>
      getAnalyticsProcessorForDocuments(
        RetrievedUserDataProcessing,
        telemetryAdapter,
        deletionsPdvIdEnricherAdapter,
        profileDeletionsOnKafkaAdapter,
        deletionsThrowAdapter
      ).process([queueItem])(),
    queueName: "%DELETES_FAILURE_QUEUE_NAME%"
  }
);
