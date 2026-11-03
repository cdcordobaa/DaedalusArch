import { LotNotReceivedError } from './errors';
import { LotStatus } from './lot-status';
import { PressingProgress, PressingTicket } from './pressing';

export class HarvestLot {
  private status: LotStatus = 'RECEIVED';
  private runRef: string | null = null;
  private juiceLitres = 0;
  private residueKg = 0;

  constructor(
    readonly id: string,
    readonly growerId: string,
    readonly variety: string,
    readonly crates: number,
    readonly deliveredOn: string,
    readonly brix: number = 0,
  ) {}

  sendToPress(ticket: PressingTicket): void {
    if (this.status !== 'RECEIVED') throw new LotNotReceivedError(this.id);
    this.runRef = ticket.runRef;
    this.status = ticket.accepted ? 'AT_PRESS' : 'REJECTED';
  }

  recordProgress(progress: PressingProgress, litres: number, residueKg: number): void {
    if (this.status !== 'AT_PRESS') return;
    if (progress === 'finished') {
      this.juiceLitres = litres;
      this.residueKg = residueKg;
      this.status = 'PRESSED';
    } else if (progress === 'failed') {
      this.status = 'REJECTED';
    }
  }

  get currentStatus(): LotStatus {
    return this.status;
  }

  get pressRunReference(): string | null {
    return this.runRef;
  }

  get juiceYield(): number {
    return this.juiceLitres;
  }

  get sugarPremium(): number {
    return this.brix >= 12 ? 0.05 : 0;
  }

  get residue(): number {
    return this.residueKg;
  }
}
