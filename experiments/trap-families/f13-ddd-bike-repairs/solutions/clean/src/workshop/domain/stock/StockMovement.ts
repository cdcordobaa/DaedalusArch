export type StockMovementKind = 'received' | 'used';

export interface StockMovement {
  readonly kind: StockMovementKind;
  readonly sku: string;
  readonly quantity: number;
  readonly jobId: string | null;
}
