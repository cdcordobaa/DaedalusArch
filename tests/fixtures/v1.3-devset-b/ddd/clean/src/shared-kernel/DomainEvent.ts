/** Shared kernel: the contract every domain event implements. */
export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
}
