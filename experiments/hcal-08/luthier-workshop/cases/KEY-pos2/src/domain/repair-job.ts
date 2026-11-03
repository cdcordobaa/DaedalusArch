import { JobNotBookedError } from './errors';
import { InstrumentKind } from './instrument';
import { JobStatus } from './job-status';
import { surchargeFor } from './surcharge';
import { DeliveryStage, SupplyTicket } from './supply';

export class RepairJob {
  private status: JobStatus = 'BOOKED';
  private supplyRef: string | null = null;
  private arrival: string | null = null;
  private surcharge = 0;

  constructor(
    readonly id: string,
    readonly ownerId: string,
    readonly instrument: InstrumentKind,
    readonly partSku: string,
    readonly timber: string,
  ) {}

  awaitParts(ticket: SupplyTicket): void {
    if (this.status !== 'BOOKED') throw new JobNotBookedError(this.id);
    if (ticket.availability === 'unavailable') return;
    this.supplyRef = ticket.supplyRef;
    this.arrival = ticket.arrivalDate;
    this.surcharge = surchargeFor(ticket.grade);
    this.status = 'AWAITING_PARTS';
  }

  partsUpdate(stage: DeliveryStage): void {
    if (this.status !== 'AWAITING_PARTS') return;
    if (stage === 'delivered') this.status = 'IN_REPAIR';
    else if (stage === 'cancelled') this.status = 'BOOKED';
  }

  get currentStatus(): JobStatus {
    return this.status;
  }

  get supplyReference(): string | null {
    return this.supplyRef;
  }

  get timberSurcharge(): number {
    return this.surcharge;
  }

  get expectedArrival(): string | null {
    return this.arrival;
  }
}
