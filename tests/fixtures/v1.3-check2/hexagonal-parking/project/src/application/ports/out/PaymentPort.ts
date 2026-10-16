export interface PaymentPort {
  authorise(reference: string, amountCents: number): Promise<boolean>;
  refund(reference: string): Promise<void>;
}
