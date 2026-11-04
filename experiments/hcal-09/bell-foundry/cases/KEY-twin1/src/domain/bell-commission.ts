import { acceptsTuning, metalRequiredKg } from './casting';
import { CommissionStatus } from './commission-status';
import { CommissionNotQuotedError } from './errors';
import { MetalLot, MetalReadiness } from './metal-lot';
import { NoteName } from './note';

const STAGE_LABEL: Record<CommissionStatus, string> = {
  QUOTED: 'quoted',
  METAL_ORDERED: 'waiting for bronze',
  CAST: 'cast, awaiting tuning',
  TUNED: 'tuned and ready to hang',
  WITHDRAWN: 'withdrawn',
};

export class BellCommission {
  private status: CommissionStatus = 'QUOTED';
  private lot: MetalLot | null = null;
  private tuningCents: number | null = null;

  constructor(
    readonly id: string,
    readonly parishId: string,
    readonly note: NoteName,
    readonly octave: number,
    readonly weightKg: number,
  ) {}

  get metalNeededKg(): number {
    return metalRequiredKg(this.weightKg);
  }

  orderMetal(lot: MetalLot): void {
    if (this.status !== 'QUOTED') throw new CommissionNotQuotedError(this.id);
    if (lot.readiness === 'refused') return;
    this.lot = lot;
    this.status = 'METAL_ORDERED';
  }

  metalUpdate(readiness: MetalReadiness): void {
    if (this.status !== 'METAL_ORDERED' || this.lot === null) return;
    this.lot = { ...this.lot, readiness };
    if (readiness === 'arrived') this.status = 'CAST';
    else if (readiness === 'refused') this.status = 'QUOTED';
  }

  recordTuning(centsOff: number): boolean {
    if (this.status !== 'CAST') return false;
    this.tuningCents = centsOff;
    if (acceptsTuning(centsOff)) this.status = 'TUNED';
    return this.status === 'TUNED';
  }

  get stageLabel(): string {
    return STAGE_LABEL[this.status];
  }

  get currentStatus(): CommissionStatus {
    return this.status;
  }

  get lotReference(): string | null {
    return this.lot?.lotRef ?? null;
  }

  get lastTuningCents(): number | null {
    return this.tuningCents;
  }
}
