import { ClearanceState, FilingReceipt } from './clearance';
import { AlreadyFiledError } from './errors';

export class Shipment {
  private state: ClearanceState = 'awaiting-filing';
  private entryRef: string | null = null;
  private dutyCents = 0;
  private portalStatus = '';

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
    this.state = receipt.outcome === 'accepted' ? 'filed' : receipt.outcome === 'needs-attention' ? 'on-hold' : 'refused';
  }

  get clearanceState(): ClearanceState {
    return this.state;
  }

  get customsEntryRef(): string | null {
    return this.entryRef;
  }

  setPortalStatus(code: string): void {
    this.portalStatus = code;
  }

  get clientPortalStatus(): string {
    return this.portalStatus;
  }

  get assessedDutyCents(): number {
    return this.dutyCents;
  }
}
