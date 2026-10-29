export interface CardPayments {
  status(paymentId: string): Promise<string>;
  capture(paymentId: string): Promise<{ status: string; amountTaken: number }>;
  cancel(paymentId: string): Promise<void>;
}
