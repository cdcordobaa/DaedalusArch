export interface RefundsPort {
  open(orderId: string): Promise<void>;
}
