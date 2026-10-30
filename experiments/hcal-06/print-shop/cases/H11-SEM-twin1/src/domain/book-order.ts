import { OrderNotInProductionError, OrderNotPlacedError } from './errors';
import { Finish, OrderStatus } from './order-status';
import { ArtworkIssue, ProductionTicket } from './production';
import { ProductionPhase } from './production-phase';

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

  advance(phase: ProductionPhase, trackingRef: string | null): void {
    switch (phase) {
      case 'in-production':
        return;
      case 'on-its-way':
        if (this.status === 'IN_PRODUCTION') this.markDispatched(trackingRef);
        return;
      case 'stopped':
        this.status = 'WITHDRAWN';
        return;
    }
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
