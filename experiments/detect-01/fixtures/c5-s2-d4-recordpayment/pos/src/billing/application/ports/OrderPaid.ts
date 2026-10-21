export interface OrderPaidNotifier {
  orderPaid(orderId: string): Promise<void>;
}
