import { TableEntity, TableInsertEntityHeaders } from "@azure/data-tables";

export class TableClient {
  constructor() {}

  createEntity = jest.fn().mockImplementation(
    async <T extends object>(
      entity: TableEntity<T>,
      options?: any
    ): Promise<TableInsertEntityHeaders> => ({
      requestId: entity.rowKey
    })
  );
}
