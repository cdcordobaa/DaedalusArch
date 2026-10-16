import { CertificationSnapshot, Incident, Shift } from "./incident";

export interface IncidentRepository {
  save(i: Incident): void;
  findById(id: string): Incident | undefined;
  findAll(): Incident[];
}

export interface ShiftRepository {
  save(s: Shift): void;
  findById(id: string): Shift | undefined;
  findByIncident(incidentId: string): Shift[];
  findByVolunteer(volunteerId: string): Shift[];
}

/** Deployment's own view of the volunteer registry. */
export interface VolunteerDirectory {
  exists(volunteerId: string): boolean;
  isQualified(volunteerId: string, skill: string, onDate: string): Promise<boolean>;
  /** The volunteer's home region, undefined when the volunteer is unknown. */
  homeRegion(volunteerId: string): string | undefined;
  /** The certification currently held for the skill, if any. */
  certification(volunteerId: string, skill: string): CertificationSnapshot | undefined;
  /** Every skill name known to the registry. */
  skillNames(): string[];
  qualifiedVolunteers(skill: string, onDate: string): Promise<{ id: string; name: string }[]>;
}
