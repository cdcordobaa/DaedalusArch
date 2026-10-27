export interface PaymentView {
  readonly id: string;
  readonly ticketCode: string;
  readonly status: string;
  readonly amountCents: number;
}
