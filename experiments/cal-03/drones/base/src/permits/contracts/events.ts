export interface PermitGranted {
  readonly name: 'PermitGranted';
  readonly occurredAt: Date;
  readonly surveyId: string;
  readonly permitId: string;
  readonly reference: string;
}
