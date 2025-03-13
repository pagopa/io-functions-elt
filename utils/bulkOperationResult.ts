/* eslint-disable sort-keys */

export interface IBulkOperationResult {
  readonly isSuccess: boolean;
  readonly result: string;
}

export interface IBulkOperationResultEntity extends IBulkOperationResult {
  readonly operation: string;
  readonly partitionKey: string;
  readonly rowKey: string;
}

export const toBulkOperationResultEntity =
  (operation: string) =>
  ({
    isSuccess,
    result
  }: IBulkOperationResult): IBulkOperationResultEntity => ({
    operation,
    result,
    isSuccess,
    partitionKey: `${new Date().getMonth() + 1}`,
    rowKey: `${Date.now()}`
  });
