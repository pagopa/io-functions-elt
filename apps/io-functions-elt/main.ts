/**
 * Azure Functions v4 entry point — main.ts
 *
 * Registers all HTTP, CosmosDB change-feed, and storage-queue triggers.
 * Shared dependencies are organised in the ./dependencies/ folder.
 */

import { app } from "@azure/functions";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { RetrievedUserDataProcessing } from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";

import { getAnalyticsProcessorForDocuments } from "./businesslogic/analytics-publish-documents";
import {
  deletionsPdvIdEnricherAdapter,
  deletionsThrowAdapter,
  emptyServiceEnricherAdapter,
  profileDeletionsOnKafkaAdapter,
  profileDeletionsOnQueueAdapter,
  profilePdvIdEnricherAdapter,
  profilesFilterer,
  profilesOnKafkaAdapter,
  profilesOnQueueAdapter,
  profileThrowAdapter,
  retrievedServiceOnKafkaAdapter,
  retrievedServiceOnQueueAdapter,
  servicePreferencesFilterer,
  servicePreferencesOnKafkaAdapter,
  servicePreferencesOnQueueAdapter,
  servicePreferencesPdvIdEnricherAdapter,
  servicePreferencesThrowAdapter,
  serviceThrowAdapter,
  telemetryAdapter,
  userDataProcessingFilterer
} from "./dependencies";
import { Info } from "./Info/handler";

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
