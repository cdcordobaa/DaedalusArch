import { InvoiceExporter } from '../application/InvoiceExporter';
import { InvoiceView } from '../contracts/InvoiceContracts';

export class RecordingInvoiceExporter implements InvoiceExporter {
  readonly exported: InvoiceView[] = [];

  exportAll(views: readonly InvoiceView[]): void {
    this.exported.push(...views);
  }
}
