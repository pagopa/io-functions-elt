import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { QueueClient } from "@azure/storage-queue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createBlobServiceClientFromConnectionString,
  createBlobServiceClientWithManagedIdentity,
  createContainerClientWithManagedIdentity,
  createQueueClientWithManagedIdentity,
  createTableClientWithManagedIdentity,
  extractStorageAccountNameFromConnectionString,
  getDefaultAzureCredential
} from "../azure-identity";

// Mock the Azure SDK modules
vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: vi.fn().mockImplementation(() => ({
    getToken: vi.fn().mockResolvedValue({ token: "mock-token" })
  }))
}));

vi.mock("@azure/data-tables", () => ({
  TableClient: vi.fn().mockImplementation(() => ({
    createEntity: vi.fn(),
    getEntity: vi.fn()
  }))
}));

vi.mock("@azure/storage-queue", () => ({
  QueueClient: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn(),
    receiveMessages: vi.fn()
  }))
}));

vi.mock("@azure/storage-blob", () => ({
  BlobServiceClient: vi.fn().mockImplementation(() => ({
    getContainerClient: vi.fn().mockReturnValue({
      getBlobClient: vi.fn(),
      getBlockBlobClient: vi.fn()
    })
  })),
  ContainerClient: vi.fn()
}));

// Add static method mock
(
  BlobServiceClient as unknown as {
    fromConnectionString: ReturnType<typeof vi.fn>;
  }
).fromConnectionString = vi.fn().mockReturnValue({
  getContainerClient: vi.fn().mockReturnValue({
    getBlobClient: vi.fn()
  })
});

describe("azure-identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDefaultAzureCredential", () => {
    it("should return a DefaultAzureCredential instance", () => {
      const credential = getDefaultAzureCredential();
      expect(credential).toBeDefined();
      expect(DefaultAzureCredential).toHaveBeenCalled();
    });

    it("should return the same singleton instance on subsequent calls", () => {
      const credential1 = getDefaultAzureCredential();
      const credential2 = getDefaultAzureCredential();
      // The constructor should only be called once due to singleton pattern
      // Note: since we reset mocks between tests, we check within same test
      expect(credential1).toBe(credential2);
    });
  });

  describe("createTableClientWithManagedIdentity", () => {
    it("should create a TableClient with correct URL and credentials", () => {
      const storageAccountName = "mystorageaccount";
      const tableName = "mytable";

      const client = createTableClientWithManagedIdentity(
        storageAccountName,
        tableName
      );

      expect(TableClient).toHaveBeenCalledWith(
        `https://${storageAccountName}.table.core.windows.net`,
        tableName,
        expect.any(Object) // DefaultAzureCredential instance
      );
      expect(client).toBeDefined();
    });

    it("should use the correct table endpoint format", () => {
      createTableClientWithManagedIdentity("teststorage", "testtable");

      expect(TableClient).toHaveBeenCalledWith(
        "https://teststorage.table.core.windows.net",
        "testtable",
        expect.any(Object)
      );
    });
  });

  describe("createQueueClientWithManagedIdentity", () => {
    it("should create a QueueClient with correct URL and credentials", () => {
      const storageAccountName = "mystorageaccount";
      const queueName = "myqueue";

      const client = createQueueClientWithManagedIdentity(
        storageAccountName,
        queueName
      );

      expect(QueueClient).toHaveBeenCalledWith(
        `https://${storageAccountName}.queue.core.windows.net/${queueName}`,
        expect.any(Object) // DefaultAzureCredential instance
      );
      expect(client).toBeDefined();
    });

    it("should use the correct queue endpoint format", () => {
      createQueueClientWithManagedIdentity("teststorage", "testqueue");

      expect(QueueClient).toHaveBeenCalledWith(
        "https://teststorage.queue.core.windows.net/testqueue",
        expect.any(Object)
      );
    });
  });

  describe("createBlobServiceClientWithManagedIdentity", () => {
    it("should create a BlobServiceClient with correct URL and credentials", () => {
      const storageAccountName = "mystorageaccount";

      const client =
        createBlobServiceClientWithManagedIdentity(storageAccountName);

      expect(BlobServiceClient).toHaveBeenCalledWith(
        `https://${storageAccountName}.blob.core.windows.net`,
        expect.any(Object) // DefaultAzureCredential instance
      );
      expect(client).toBeDefined();
    });

    it("should use the correct blob endpoint format", () => {
      createBlobServiceClientWithManagedIdentity("teststorage");

      expect(BlobServiceClient).toHaveBeenCalledWith(
        "https://teststorage.blob.core.windows.net",
        expect.any(Object)
      );
    });
  });

  describe("createContainerClientWithManagedIdentity", () => {
    it("should create a ContainerClient via BlobServiceClient", () => {
      const storageAccountName = "mystorageaccount";
      const containerName = "mycontainer";

      const client = createContainerClientWithManagedIdentity(
        storageAccountName,
        containerName
      );

      expect(BlobServiceClient).toHaveBeenCalledWith(
        `https://${storageAccountName}.blob.core.windows.net`,
        expect.any(Object)
      );
      expect(client).toBeDefined();
    });
  });

  describe("extractStorageAccountNameFromConnectionString", () => {
    it("should extract account name from a valid connection string", () => {
      const connectionString =
        "DefaultEndpointsProtocol=https;AccountName=mystorageaccount;AccountKey=abc123;EndpointSuffix=core.windows.net";

      const result =
        extractStorageAccountNameFromConnectionString(connectionString);

      expect(result).toBe("mystorageaccount");
    });

    it("should extract account name case-insensitively", () => {
      const connectionString =
        "DefaultEndpointsProtocol=https;accountname=MyAccount;AccountKey=abc123";

      const result =
        extractStorageAccountNameFromConnectionString(connectionString);

      expect(result).toBe("MyAccount");
    });

    it("should return undefined for invalid connection string", () => {
      const connectionString = "invalid-connection-string";

      const result =
        extractStorageAccountNameFromConnectionString(connectionString);

      expect(result).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      const result = extractStorageAccountNameFromConnectionString("");

      expect(result).toBeUndefined();
    });

    it("should handle connection string with AccountName at different positions", () => {
      const connectionString =
        "AccountKey=abc123;AccountName=firststorage;EndpointSuffix=core.windows.net";

      const result =
        extractStorageAccountNameFromConnectionString(connectionString);

      expect(result).toBe("firststorage");
    });

    it("should handle Azurite local development connection string", () => {
      const connectionString =
        "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1";

      const result =
        extractStorageAccountNameFromConnectionString(connectionString);

      expect(result).toBe("devstoreaccount1");
    });
  });

  describe("createBlobServiceClientFromConnectionString", () => {
    it("should create a BlobServiceClient from connection string", () => {
      const connectionString =
        "DefaultEndpointsProtocol=https;AccountName=test;AccountKey=abc123;EndpointSuffix=core.windows.net";

      const client =
        createBlobServiceClientFromConnectionString(connectionString);

      expect(BlobServiceClient.fromConnectionString).toHaveBeenCalledWith(
        connectionString
      );
      expect(client).toBeDefined();
    });
  });
});
