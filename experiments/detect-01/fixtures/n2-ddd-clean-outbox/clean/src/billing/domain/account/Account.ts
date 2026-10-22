/** Aggregate root of the billing context: a customer's receivable. */
export class Account {
  private openCents = 0;

  constructor(readonly id: string) {}

  charge(cents: number): void {
    if (cents <= 0) throw new Error('A charge must be positive');
    this.openCents += cents;
  }

  open(): number {
    return this.openCents;
  }
}
