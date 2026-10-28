import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class PermitGranted implements DomainEvent {
  readonly name = 'PermitGranted';
  readonly occurredAt = new Date();

  constructor(
    readonly surveyId: string,
    readonly permitId: string,
    readonly reference: string,
  ) {}
}
