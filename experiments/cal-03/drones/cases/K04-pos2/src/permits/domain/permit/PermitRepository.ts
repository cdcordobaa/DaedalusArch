import type { FlightPermit } from './FlightPermit';

export interface PermitRepository {
  nextId(): string;
  save(permit: FlightPermit): void;
  findById(id: string): FlightPermit | undefined;
  findBySurveyId(surveyId: string): FlightPermit | undefined;
  saveAll(permits: FlightPermit[]): void;
}
