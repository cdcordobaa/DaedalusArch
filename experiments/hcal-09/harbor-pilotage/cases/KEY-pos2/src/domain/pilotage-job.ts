import { JobNotSchedulableError } from './errors';
import { JobStatus } from './job-status';
import { Money } from './money';
import { pilotageFee } from './pilotage-fee';
import { clearanceOf, TideSlot } from './tide-slot';
import { VesselStage } from './vessel-stage';

export class PilotageJob {
  private status: JobStatus = 'REQUESTED';
  private slot: TideSlot | null = null;
  private fee: Money | null = null;

  constructor(
    readonly id: string,
    readonly vesselImo: string,
    readonly agentId: string,
    readonly draughtMetres: number,
    readonly etaUtc: string,
  ) {}

  schedule(slot: TideSlot): void {
    if (this.status !== 'REQUESTED') throw new JobNotSchedulableError(this.id);
    if (clearanceOf(slot) === 'none') return;
    this.slot = slot;
    this.fee = pilotageFee(this.draughtMetres, new Date(slot.opensAt).getUTCHours(), slot.hullClass);
    this.status = 'SCHEDULED';
  }

  recordMovement(stage: VesselStage): void {
    if (this.status === 'SCHEDULED' && stage === 'alongside') this.status = 'BOARDED';
    else if (this.status === 'BOARDED' && stage === 'departed') this.status = 'COMPLETED';
    else if (stage === 'abandoned' && this.status !== 'COMPLETED') this.status = 'CANCELLED';
  }

  get currentStatus(): JobStatus {
    return this.status;
  }

  get slotReference(): string | null {
    return this.slot?.slotRef ?? null;
  }

  get quotedFee(): Money | null {
    return this.fee;
  }
}
