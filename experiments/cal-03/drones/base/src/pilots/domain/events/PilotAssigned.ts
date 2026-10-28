import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class PilotAssigned implements DomainEvent {
  readonly name = 'PilotAssigned';
  readonly occurredAt = new Date();

  constructor(
    readonly pilotId: string,
    readonly surveyId: string,
    readonly hours: number,
  ) {}
}
