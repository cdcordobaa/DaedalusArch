import type { IEvent } from '@nestjs/cqrs';

/** Shared kernel: the contract every domain event implements. */
export interface DomainEvent extends IEvent {
  readonly name: string;
  readonly occurredAt: Date;
}
