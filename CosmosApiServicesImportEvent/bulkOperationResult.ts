/* eslint-disable sort-keys */

export interface IBulkOperationResult {
  readonly isSuccess: boolean;
  readonly partitionKey: string;
  readonly result: string;
  readonly rowKey: string;
}

export const toBulkOperationResult = (
  isSuccess: boolean,
  result: string
): IBulkOperationResult => ({
  result,
  isSuccess,
  partitionKey: `${new Date().getMonth() + 1}`,
  rowKey: `${Date.now()}`
});
