/* eslint-disable sort-keys */

export interface IBulkOperationResult {
  readonly isSuccess: boolean;
  readonly result: string;
}

export interface IBulkOperationResultEntity extends IBulkOperationResult {
  readonly partitionKey: string;
  readonly rowKey: string;
}

export const toBulkOperationResultEntity = ({
  isSuccess,
  result
}: IBulkOperationResult): IBulkOperationResultEntity => ({
  result,
  isSuccess,
  partitionKey: `${new Date().getMonth() + 1}`,
  rowKey: `${Date.now()}`
});
