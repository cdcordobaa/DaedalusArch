import { ClearanceState, FilingReceipt } from './clearance';
import { ClientAction, EntryDisposition } from './entry-disposition';
import { AlreadyFiledError } from './errors';

export class Shipment {
  private state: ClearanceState = 'awaiting-filing';
  private entryRef: string | null = null;
  private dutyCents = 0;
  private disposition: EntryDisposition | null = null;

  constructor(
    readonly id: string,
    readonly importerId: string,
    readonly tariffCode: string,
    readonly originCountry: string,
    readonly declaredValueCents: number,
    readonly portCode: string,
  ) {}

  recordFiling(receipt: FilingReceipt): void {
    if (this.state !== 'awaiting-filing') throw new AlreadyFiledError(this.id);
    this.entryRef = receipt.entryRef;
    this.dutyCents = receipt.dutyCents;
    this.disposition = receipt.disposition;
    this.state = receipt.outcome === 'accepted' ? 'filed' : receipt.outcome === 'needs-attention' ? 'on-hold' : 'refused';
  }

  get clearanceState(): ClearanceState {
    return this.state;
  }

  get customsEntryRef(): string | null {
    return this.entryRef;
  }

  nextClientAction(): ClientAction {
    switch (this.disposition) {
      case null:
      case 'filed':
        return 'none';
      case 'released':
        return 'arrange-pickup';
      case 'examination':
        return 'book-examination';
      case 'documents-requested':
        return 'send-documents';
      case 'refused':
        return 'prepare-protest';
    }
  }

  get assessedDutyCents(): number {
    return this.dutyCents;
  }
}
