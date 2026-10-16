import { DomainError } from './domain-error';

export class Registration {
  private cancelledAt: Date | undefined;

  constructor(
    readonly id: string,
    readonly workshopId: string,
    readonly attendeeId: string,
    readonly registeredAt: Date,
  ) {}

  get isActive(): boolean {
    return this.cancelledAt === undefined;
  }

  cancel(at: Date): void {
    if (!this.isActive) throw new DomainError('conflict', `Registration ${this.id} is already cancelled`);
    this.cancelledAt = at;
  }
}
