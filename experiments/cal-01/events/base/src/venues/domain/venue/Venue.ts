import { DomainEvent } from "../../../shared-kernel/DomainEvent";

export class SeatLabel {
  constructor(readonly row: string, readonly number: number) {
    if (row.trim() === "") throw new Error("row required");
    if (!Number.isInteger(number) || number < 1) throw new Error("seat number must be positive");
  }

  get key(): string {
    return `${this.row}-${this.number}`;
  }
}

export class Seat {
  constructor(readonly id: string, readonly label: SeatLabel) {}
}

export class SeatAdded implements DomainEvent {
  readonly type = "SeatAdded";
  constructor(readonly venueId: string, readonly seatId: string, readonly occurredAt: number) {}
}

export class Venue {
  private readonly seats: Seat[] = [];
  private readonly events: DomainEvent[] = [];

  private constructor(readonly id: string, private name: string, private readonly capacity: number) {}

  static create(id: string, name: string, capacity: number): Venue {
    if (name.trim() === "") throw new Error("venue name required");
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error("capacity must be positive");
    return new Venue(id, name, capacity);
  }

  rename(name: string): void {
    if (name.trim() === "") throw new Error("venue name required");
    this.name = name;
  }

  addSeat(label: SeatLabel, now: number): Seat {
    if (this.seats.length >= this.capacity) throw new Error("venue is full");
    if (this.seats.some((s) => s.label.key === label.key)) throw new Error("seat label already used");
    const seat = new Seat(`${this.id}:${label.key}`, label);
    this.seats.push(seat);
    this.events.push(new SeatAdded(this.id, seat.id, now));
    return seat;
  }

  hasSeat(seatId: string): boolean {
    return this.seats.some((s) => s.id === seatId);
  }

  getName(): string {
    return this.name;
  }

  getCapacity(): number {
    return this.capacity;
  }

  seatCount(): number {
    return this.seats.length;
  }

  pullEvents(): DomainEvent[] {
    const out = [...this.events];
    this.events.length = 0;
    return out;
  }
}
