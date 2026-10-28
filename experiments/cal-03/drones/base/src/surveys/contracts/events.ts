export interface SurveyBooked {
  readonly name: 'SurveyBooked';
  readonly occurredAt: Date;
  readonly surveyId: string;
  readonly siteName: string;
  readonly windowStart: Date;
  readonly windowEnd: Date;
}
