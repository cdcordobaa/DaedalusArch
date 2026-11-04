import { ColonyReading, deliverable } from './colony';
import { CropKind } from './crop';
import { ColoniesNotReadyError, PlacementNotBookedError } from './errors';
import { PlacementStatus } from './placement-status';
import { SensorCover } from './sensor-cover';
import { hivesNeeded } from './stocking';

export class Placement {
  private status: PlacementStatus = 'BOOKED';
  private readonly readings = new Map<string, ColonyReading>();
  private cover: SensorCover | null = null;

  constructor(
    readonly id: string,
    readonly growerId: string,
    readonly yardCode: string,
    readonly crop: CropKind,
    readonly hectares: number,
  ) {}

  get hiveCount(): number {
    return hivesNeeded(this.crop, this.hectares);
  }

  attachSensors(cover: SensorCover): void {
    if (this.status !== 'BOOKED') throw new PlacementNotBookedError(this.id);
    if (!cover.active) return;
    this.cover = cover;
  }

  recordReading(reading: ColonyReading): void {
    if (this.status === 'COLLECTED' || this.status === 'VOIDED') return;
    this.readings.set(reading.hiveTag, reading);
  }

  deliver(): void {
    if (this.status !== 'BOOKED') throw new PlacementNotBookedError(this.id);
    if (!deliverable([...this.readings.values()])) throw new ColoniesNotReadyError(this.id);
    this.status = 'DELIVERED';
  }

  get currentStatus(): PlacementStatus {
    return this.status;
  }

  get sensorLeaseRef(): string | null {
    return this.cover?.leaseRef ?? null;
  }
}
