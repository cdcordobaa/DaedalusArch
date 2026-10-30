import { FilingReceipt } from '../../../domain/clearance';

export interface EntryDeclaration {
  readonly importerId: string;
  readonly tariffCode: string;
  readonly originCountry: string;
  readonly declaredValueCents: number;
  readonly portCode: string;
}

export interface EntrySnapshot {
  readonly entry_number: string;
  readonly entry_status: string;
  readonly duty_amount_usd: number;
  readonly liquidation_date: string | null;
}

export interface CustomsFilingPort {
  file(declaration: EntryDeclaration): Promise<FilingReceipt>;
  lookup(entryRef: string): Promise<EntrySnapshot>;
}
