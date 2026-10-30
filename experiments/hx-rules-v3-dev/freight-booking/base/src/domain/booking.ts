import { BookingClosedError } from './errors';

export type BookingStatus = 'requested' | 'confirmed' | 'held' | 'refused';

export interface CarrierAnswer {
  readonly reference: string;
  readonly outcome: 'confirmed' | 'held' | 'refused';
  readonly chargeCents: number;
}

export class Booking {
  private status: BookingStatus = 'requested';
  private reference: string | null = null;
  private chargeCents = 0;

  constructor(
    readonly id: string,
    readonly shipperId: string,
    readonly laneCode: string,
    readonly palletCount: number,
  ) {}

  record(answer: CarrierAnswer): void {
    if (this.status !== 'requested') throw new BookingClosedError(this.id);
    this.reference = answer.reference;
    this.chargeCents = answer.outcome === 'confirmed' ? answer.chargeCents : 0;
    this.status = answer.outcome;
  }

  get currentStatus(): BookingStatus {
    return this.status;
  }

  get carrierReference(): string | null {
    return this.reference;
  }

  get charge(): number {
    return this.chargeCents;
  }
}
