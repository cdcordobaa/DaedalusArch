/** An order of flour bags for one delivery day (YYYY-MM-DD); the total is in euros. */
export interface FlourOrder {
  readonly orderId: string;
  readonly sku: string;
  readonly bags: number;
  readonly deliverOn: string;
  readonly supplierOrderNo: string;
  readonly total: number;
}
