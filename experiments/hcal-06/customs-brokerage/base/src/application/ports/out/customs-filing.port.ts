import { FilingReceipt } from '../../../domain/clearance';

export interface EntryDeclaration {
  readonly importerId: string;
  readonly tariffCode: string;
  readonly originCountry: string;
  readonly declaredValueCents: number;
  readonly portCode: string;
}

export interface CustomsFilingPort {
  file(declaration: EntryDeclaration): Promise<FilingReceipt>;
}
