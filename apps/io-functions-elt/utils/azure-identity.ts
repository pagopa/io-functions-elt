/**
 * Azure Identity utilities for RBAC-based authentication.
 * This module provides factory functions to create Azure SDK clients
 * using Managed Identity (DefaultAzureCredential) instead of access keys.
 */
import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";
import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential
} from "@azure/storage-blob";
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

/**
 * Create a BlobServiceClient using RBAC authentication.
 * Requires "Storage Blob Data Contributor" role on the storage account.
 *
 * @param storageAccountName - The name of the Azure Storage account
 * @returns A BlobServiceClient instance authenticated via Managed Identity
 */
export const createBlobServiceClientWithManagedIdentity = (
  storageAccountName: string
): BlobServiceClient =>
  new BlobServiceClient(
    `https://${storageAccountName}.blob.core.windows.net`,
    getDefaultAzureCredential()
  );

/**
 * Create a ContainerClient using RBAC authentication.
 * Requires "Storage Blob Data Contributor" role on the storage account.
 *
 * @param storageAccountName - The name of the Azure Storage account
 * @param containerName - The name of the blob container
 * @returns A ContainerClient instance authenticated via Managed Identity
 */
export const createContainerClientWithManagedIdentity = (
  storageAccountName: string,
  containerName: string
): ContainerClient =>
  createBlobServiceClientWithManagedIdentity(
    storageAccountName
  ).getContainerClient(containerName);

/**
 * Extract storage account name from a connection string.
 * Useful for migrating from connection string-based auth to RBAC.
 *
 * @param connectionString - Azure Storage connection string
 * @returns The storage account name, or undefined if not found
 */
export const extractStorageAccountNameFromConnectionString = (
  connectionString: string
): string | undefined => {
  const match = connectionString.match(/AccountName=([^;]+)/i);
  return match?.[1];
};

/**
 * Create a BlobServiceClient from a connection string.
 * This is used for backward compatibility when connection strings are still needed
 * (e.g., for local development with Azurite or when RBAC is not yet configured).
 *
 * @param connectionString - Azure Storage connection string
 * @returns A BlobServiceClient instance
 */
export const createBlobServiceClientFromConnectionString = (
  connectionString: string
): BlobServiceClient =>
  BlobServiceClient.fromConnectionString(connectionString);

// Re-export for convenience
export { StorageSharedKeyCredential, TokenCredential };
