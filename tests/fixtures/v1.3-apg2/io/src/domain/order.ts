// Every import of the domain is clean: no package, no other layer. The I/O below is through globals.
export class Order {
  placedAt = 0;
  createdAt?: Date;

  // IO1: wall clock in an entity method (clock, advisory).
  place(): void {
    this.placedAt = Date.now();
  }

  // IO2: `new Date()` with no argument reads the clock.
  stamp(): void {
    this.createdAt = new Date();
  }

  // NM-IO1: `new Date(iso)` converts a value; it reads no clock.
  restore(iso: string): void {
    this.createdAt = new Date(iso);
  }
}
