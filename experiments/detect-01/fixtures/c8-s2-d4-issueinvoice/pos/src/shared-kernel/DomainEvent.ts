/** Shared kernel: a fact that happened in a domain. */
export interface DomainEvent {
  readonly name: string;
  readonly occurredOn: Date;
}
