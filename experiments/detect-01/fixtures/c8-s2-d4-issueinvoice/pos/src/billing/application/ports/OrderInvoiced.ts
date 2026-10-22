export interface OrderInvoicedNotifier {
  orderInvoiced(orderId: string): Promise<void>;
}
