# @pagopa/io-functions-elt

## 3.2.0

### Minor Changes

- 8070438: Remove unused `CosmosApiServicesChangeFeed` and `CosmosApiServicesImportEvent` triggers

## 3.1.1

### Patch Changes

- 8bbe9f2: fix:use the right table storage for errors

## 3.1.0

### Minor Changes

- 8d30f10: Remove legacy Messages Ingestion Functions

  This release removes 8 obsolete Azure Functions and related code that were part of the deprecated message analytics pipeline:

  - AnalyticsMessagesChangeFeedInboundProcessorAdapter
  - AnalyticsMessagesStorageQueueInboundProcessorAdapter
  - AnalyticsMessageStatusChangeFeedInboundProcessorAdapter
  - AnalyticsMessageStatusStorageQueueInbloundAdapter
  - CosmosApiMessagesChangeFeed
  - CosmosApiMessageStatusChangeFeed
  - EnrichMessagesReportBlobTrigger
  - CreateMessageReportTimeTrigger

  Also removed:

  - Message-related handlers, formatters, and Avro schemas
  - Messages and message-status test files
  - Unused notification-status schema and formatter
  - Configuration cleanup (14 App Settings removed)

  Total deletion: ~3,186 lines of code

  **Breaking Change Note:** Azure infrastructure cleanup required - Event Hub topics, Storage queues, Blob containers, and App Settings need manual removal.

## 3.0.3

### Patch Changes

- 2f534a4: Fix generate TableClient from connection string

## 3.0.2

### Patch Changes

- fde75be: Use secondary storage for queues and refactory configuration ENVs

## 3.0.1

### Patch Changes

- 4e1a074: Refactory to use RBAC for INTERNAL storage account

## 3.0.0

### Major Changes

- 1ca7ffc: monorepo refactory
