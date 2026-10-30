export interface TicketView {
  readonly ticket: string;
  readonly slot: string;
  readonly visitors: number;
  /** Euros. */
  readonly price: number;
}

export interface SlotView {
  readonly slot: string;
  readonly spacesLeft: number;
}

export interface BuyTickets {
  slotsOn(day: string): Promise<SlotView[]>;
  buy(slot: string, visitors: number): Promise<TicketView>;
}
