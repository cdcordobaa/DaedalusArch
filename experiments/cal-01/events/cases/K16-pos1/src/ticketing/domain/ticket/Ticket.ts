import type { Show } from "../show/Show";

export type TicketStatus = "valid" | "refunded";

export class Ticket {
  private status: TicketStatus = "valid";
  private serviceFeeCents = 0;
  private show: Show | undefined;

  private constructor(
    readonly code: string,
    readonly showId: string,
    readonly seatId: string,
    readonly buyerId: string,
    private readonly priceCents: number,
  ) {}

  static issue(code: string, showId: string, seatId: string, buyerId: string, priceCents: number): Ticket {
    if (code === "") throw new Error("ticket code required");
    if (priceCents < 0) throw new Error("price cannot be negative");
    return new Ticket(code, showId, seatId, buyerId, priceCents);
  }

  attachShow(show: Show): void {
    this.show = show;
  }

  showTitle(): string {
    return this.show === undefined ? "" : this.show.getTitle();
  }

  refund(): void {
    if (this.status === "refunded") throw new Error("ticket already refunded");
    this.status = "refunded";
  }

  canRefund(): boolean {
    return this.status === "valid";
  }

  isRefunded(): boolean {
    return this.status === "refunded";
  }

  getStatus(): TicketStatus {
    return this.status;
  }

  getPriceCents(): number {
    return this.priceCents;
  }

  getServiceFeeCents(): number {
    return this.serviceFeeCents;
  }

  setServiceFee(cents: number): void {
    if (cents < 0) throw new Error("fee cannot be negative");
    this.serviceFeeCents = cents;
  }

  applyServiceFee(): void {
    this.setServiceFee(Math.round(this.priceCents * 0.1));
  }
}
