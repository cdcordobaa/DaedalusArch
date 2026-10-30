import { OrderNotDispatchedError, OrderNotInProductionError, OrderNotPlacedError } from './errors';
import { Finish, OrderStatus } from './order-status';
import { ArtworkIssue, ProductionTicket } from './production';

export class BookOrder {
  private status: OrderStatus = 'PLACED';
  private productionRef: string | null = null;
  private trackingRef: string | null = null;
  private issues: readonly ArtworkIssue[] = [];

  constructor(
    readonly id: string,
    readonly customerId: string,
    readonly sku: string,
    readonly pageCount: number,
    readonly copies: number,
    readonly finish: Finish,
    readonly postcode: string,
  ) {}

  startProduction(ticket: ProductionTicket): void {
    if (this.status !== 'PLACED') throw new OrderNotPlacedError(this.id);
    this.productionRef = ticket.productionRef;
    this.issues = ticket.artworkIssues;
    this.status = ticket.outcome === 'accepted' ? 'IN_PRODUCTION' : 'WITHDRAWN';
  }

  markDispatched(trackingRef: string | null): void {
    if (this.status !== 'IN_PRODUCTION') throw new OrderNotInProductionError(this.id);
    this.trackingRef = trackingRef;
    this.status = 'DISPATCHED';
  }

  confirmReceipt(): void {
    if (this.status !== 'DISPATCHED') throw new OrderNotDispatchedError(this.id);
    this.status = 'DELIVERED';
  }

  get isComplete(): boolean {
    return this.status === 'DELIVERED';
  }

  get currentStatus(): OrderStatus {
    return this.status;
  }

  get productionReference(): string | null {
    return this.productionRef;
  }

  get trackingReference(): string | null {
    return this.trackingRef;
  }

  get artworkIssues(): readonly ArtworkIssue[] {
    return this.issues;
  }
}
