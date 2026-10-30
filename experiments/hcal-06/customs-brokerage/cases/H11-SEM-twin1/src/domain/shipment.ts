import { ClearanceState, FilingReceipt } from './clearance';
import { AmendmentWindow } from './amendment';
import { AlreadyFiledError } from './errors';

export class Shipment {
  private state: ClearanceState = 'awaiting-filing';
  private entryRef: string | null = null;
  private dutyCents = 0;
  private amendment: AmendmentWindow = 'open';

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
    this.amendment = receipt.amendment;
    this.state = receipt.outcome === 'accepted' ? 'filed' : receipt.outcome === 'needs-attention' ? 'on-hold' : 'refused';
  }

  get clearanceState(): ClearanceState {
    return this.state;
  }

  get customsEntryRef(): string | null {
    return this.entryRef;
  }

  canAmend(): boolean {
    switch (this.amendment) {
      case 'open':
        return true;
      case 'closing':
        return this.state !== 'refused';
      case 'closed':
        return false;
    }
  }

  get assessedDutyCents(): number {
    return this.dutyCents;
  }
}
