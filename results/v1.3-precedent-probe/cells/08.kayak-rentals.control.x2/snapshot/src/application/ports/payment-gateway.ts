export interface PaymentResult {
  readonly paymentId: string;
  readonly amountCents: number;
}

export interface PaymentGateway {
  charge(customerEmail: string, amountCents: number, reference: string): Promise<PaymentResult>;
  refund(paymentId: string, reference: string): Promise<PaymentResult>;
}
