import { InvoiceView } from '../contracts/InvoiceContracts';

export interface InvoiceExporter {
  exportAll(views: readonly InvoiceView[]): void;
}
