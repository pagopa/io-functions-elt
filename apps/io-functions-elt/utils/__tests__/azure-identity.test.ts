import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { QueueClient } from "@azure/storage-queue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createQueueClientWithManagedIdentity,
  createTableClientWithManagedIdentity,
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
});
