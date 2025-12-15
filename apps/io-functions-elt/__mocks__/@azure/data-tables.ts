import { TableEntity, TableInsertEntityHeaders } from "@azure/data-tables";
import { vi } from "vitest";

export class TableClient {
  constructor() {}

  createEntity = vi.fn().mockImplementation(
    async <T extends object>(
      entity: TableEntity<T>,
      options?: any
    ): Promise<TableInsertEntityHeaders> => ({
      requestId: entity.rowKey
    })
  );
}
