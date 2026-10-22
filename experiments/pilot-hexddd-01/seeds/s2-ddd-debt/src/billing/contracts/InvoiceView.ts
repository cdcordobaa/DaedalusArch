export interface InvoiceView {
  readonly invoiceId: string;
  readonly orderId: string;
  readonly totalCents: number;
  readonly currency: string;
}
