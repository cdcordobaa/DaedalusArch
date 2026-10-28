import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class SurveyCancelled implements DomainEvent {
  readonly name = 'SurveyCancelled';
  readonly occurredAt = new Date();

  constructor(readonly surveyId: string) {}
}
