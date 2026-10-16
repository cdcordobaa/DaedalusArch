import { InvoiceRecord } from '../../persistence/invoice.entity';

export interface SellDayPassInput {
  readonly email: string;
  readonly date: string;
  readonly quantity: number;
}

export interface DayPassView {
  readonly id: string;
  readonly date: string;
  readonly quantity: number;
  readonly totalCents: number;
}

export interface InvoiceView {
  readonly id: string;
  readonly period: string;
  readonly amountCents: number;
  readonly status: string;
}

export function toInvoiceView(i: InvoiceRecord): InvoiceView {
  return { id: i.id, period: i.period, amountCents: i.amountCents, status: i.status };
}
