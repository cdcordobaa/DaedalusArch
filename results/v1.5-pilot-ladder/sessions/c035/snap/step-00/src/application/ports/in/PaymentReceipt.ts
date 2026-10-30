export interface ReceiptView {
  readonly paymentId: string;
  readonly line: string;
}

export interface PaymentReceipt {
  receipt(paymentId: string): Promise<ReceiptView>;
}
