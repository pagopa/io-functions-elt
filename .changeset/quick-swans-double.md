---
"io-functions-elt": minor
---

Remove legacy Messages Ingestion Functions

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
