/** Published command of the ordering context. */
export interface OrderPaidCommand {
  markPaid(orderId: string): Promise<void>;
}
