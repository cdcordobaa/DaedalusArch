export interface AirspaceAuthority {
  requestClearance(surveyRef: string, from: Date, to: Date): string;
}
