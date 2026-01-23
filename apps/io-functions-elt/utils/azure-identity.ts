/**
 * Azure Identity utilities for RBAC-based authentication.
 * This module provides factory functions to create Azure SDK clients
 * using Managed Identity (DefaultAzureCredential) instead of access keys.
 */
import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";
import { QueueClient } from "@azure/storage-queue";

// Singleton credential instance for reuse across clients
let defaultCredential: TokenCredential | undefined;

/**
 * Get or create the DefaultAzureCredential singleton.
 * DefaultAzureCredential tries multiple authentication methods in order:
 * - Environment variables
 * - Managed Identity
 * - Azure CLI
 * - etc.
 */
export const getDefaultAzureCredential = (): TokenCredential => {
  if (!defaultCredential) {
    defaultCredential = new DefaultAzureCredential();
  }
  return defaultCredential;
};

/**
 * Create a TableClient using RBAC authentication.
 * Requires "Storage Table Data Contributor" role on the storage account.
 *
 * @param storageAccountName - The name of the Azure Storage account
 * @param tableName - The name of the table
 * @returns A TableClient instance authenticated via Managed Identity
 */
export const createTableClientWithManagedIdentity = (
  storageAccountName: string,
  tableName: string
): TableClient =>
  new TableClient(
    `https://${storageAccountName}.table.core.windows.net`,
    tableName,
    getDefaultAzureCredential()
  );

/**
 * Create a QueueClient using RBAC authentication.
 * Requires "Storage Queue Data Contributor" role on the storage account.
 *
 * @param storageAccountName - The name of the Azure Storage account
 * @param queueName - The name of the queue
 * @returns A QueueClient instance authenticated via Managed Identity
 */
export const createQueueClientWithManagedIdentity = (
  storageAccountName: string,
  queueName: string
): QueueClient =>
  new QueueClient(
    `https://${storageAccountName}.queue.core.windows.net/${queueName}`,
    getDefaultAzureCredential()
  );
