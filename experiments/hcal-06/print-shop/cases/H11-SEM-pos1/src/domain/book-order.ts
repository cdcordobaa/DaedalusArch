import { OrderNotInProductionError, OrderNotPlacedError } from './errors';
import { Finish, OrderStatus } from './order-status';
import { ArtworkIssue, ProductionTicket } from './production';
import { ProductionStage } from './production-stage';

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

  advance(stage: ProductionStage, trackingRef: string | null): void {
    switch (stage) {
      case ProductionStage.Queued:
      case ProductionStage.Checking:
      case ProductionStage.OnPress:
      case ProductionStage.Finishing:
      case ProductionStage.Boxed:
        return;
      case ProductionStage.InTransit:
      case ProductionStage.Arrived:
        if (this.status === 'IN_PRODUCTION') this.markDispatched(trackingRef);
        return;
      case ProductionStage.Stopped:
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
