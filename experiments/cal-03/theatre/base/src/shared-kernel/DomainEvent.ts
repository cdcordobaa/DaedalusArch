export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: number;
}
