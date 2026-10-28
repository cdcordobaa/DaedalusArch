export interface PilotAssigned {
  readonly name: 'PilotAssigned';
  readonly occurredAt: Date;
  readonly pilotId: string;
  readonly surveyId: string;
  readonly hours: number;
}
