import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class SurveyBooked implements DomainEvent {
  readonly name = 'SurveyBooked';
  readonly occurredAt = new Date();

  constructor(
    readonly surveyId: string,
    readonly siteName: string,
    readonly windowStart: Date,
    readonly windowEnd: Date,
  ) {}
}
