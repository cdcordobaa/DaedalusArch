import { CustomsFilingPort, EntryDeclaration } from '../../../application/ports/out/customs-filing.port';
import { FilingReceipt } from '../../../domain/clearance';

export class AuditLogFilingDecorator implements CustomsFilingPort {
  constructor(private readonly inner: CustomsFilingPort) {}

  async file(declaration: EntryDeclaration): Promise<FilingReceipt> {
    console.log(`[audit] filing for ${declaration.importerId} at ${declaration.portCode}`);
    const receipt = await this.inner.file(declaration);
    console.log(`[audit] entry ${receipt.entryRef}: ${receipt.outcome}`);
    return receipt;
  }
}
