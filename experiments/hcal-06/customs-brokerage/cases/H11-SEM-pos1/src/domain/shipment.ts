import { ClearanceState, FilingReceipt } from './clearance';
import { AlreadyFiledError } from './errors';
import { FilingStage } from './filing-stage';

export class Shipment {
  private state: ClearanceState = 'awaiting-filing';
  private entryRef: string | null = null;
  private dutyCents = 0;
  private stage: FilingStage | null = null;

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
    this.stage = receipt.stage;
    this.state = receipt.outcome === 'accepted' ? 'filed' : receipt.outcome === 'needs-attention' ? 'on-hold' : 'refused';
  }

  get clearanceState(): ClearanceState {
    return this.state;
  }

  get customsEntryRef(): string | null {
    return this.entryRef;
  }

  canAmend(): boolean {
    switch (this.stage) {
      case null:
      case 'intake':
      case 'screening':
      case 'classification':
        return true;
      case 'valuation':
      case 'sign-off':
      case 'transmitted':
        return false;
    }
  }

  get assessedDutyCents(): number {
    return this.dutyCents;
  }
}
