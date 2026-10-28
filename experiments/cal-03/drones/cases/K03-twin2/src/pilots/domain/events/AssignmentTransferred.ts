import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class AssignmentTransferred implements DomainEvent {
  readonly name = 'AssignmentTransferred';
  readonly occurredAt = new Date();

  constructor(
    readonly fromPilotId: string,
    readonly surveyId: string,
  ) {}
}
