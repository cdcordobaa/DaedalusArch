export type SkillName = string;

export class DomainError extends Error {}

export interface Incident {
  id: string;
  name: string;
  region: string;
  /** ISO date YYYY-MM-DD */
  startDate: string;
}

export interface Shift {
  id: string;
  incidentId: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Hour of day the shift starts (0-23) */
  startHour: number;
  /** Duration in hours */
  hours: number;
  requiredSkill: SkillName;
  peopleNeeded: number;
  volunteerIds: string[];
  /** Certification each assigned volunteer relied on when assigned (absent when the skill needs none). */
  certifications?: Record<string, CertificationRef>;
}

export interface CertificationRef {
  number: string;
  expiresOn: string;
}

export function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));
}

export function validateShift(s: Pick<Shift, "startHour" | "hours" | "peopleNeeded" | "date">): void {
  if (!isIsoDate(s.date)) throw new DomainError("date must be YYYY-MM-DD");
  if (!Number.isInteger(s.startHour) || s.startHour < 0 || s.startHour > 23) throw new DomainError("startHour must be an integer 0-23");
  if (!(s.hours > 0) || s.hours > 24) throw new DomainError("hours must be in (0, 24]");
  if (!Number.isInteger(s.peopleNeeded) || s.peopleNeeded < 1) throw new DomainError("peopleNeeded must be a positive integer");
}

function interval(s: Shift): [number, number] {
  const start = Date.parse(s.date + "T00:00:00Z") + s.startHour * 3_600_000;
  return [start, start + s.hours * 3_600_000];
}

export function overlaps(a: Shift, b: Shift): boolean {
  const [as, ae] = interval(a);
  const [bs, be] = interval(b);
  return as < be && bs < ae;
}

/** Enforces shift capacity, no double assignment and no overlap with the volunteer's other shifts. */
export function assignVolunteer(shift: Shift, volunteerId: string, volunteerShifts: Shift[], cert?: CertificationRef): void {
  if (shift.volunteerIds.includes(volunteerId)) throw new DomainError("Volunteer is already assigned to this shift");
  if (shift.volunteerIds.length >= shift.peopleNeeded) throw new DomainError("Shift is already full");
  const clash = volunteerShifts.find((o) => o.id !== shift.id && overlaps(o, shift));
  if (clash) throw new DomainError(`Volunteer already has overlapping shift ${clash.id}`);
  shift.volunteerIds.push(volunteerId);
  if (cert) shift.certifications = { ...shift.certifications, [volunteerId]: cert };
}

export function unassignVolunteer(shift: Shift, volunteerId: string): void {
  if (!shift.volunteerIds.includes(volunteerId)) throw new DomainError("Volunteer is not assigned to this shift");
  shift.volunteerIds = shift.volunteerIds.filter((x) => x !== volunteerId);
  if (shift.certifications) {
    const rest = { ...shift.certifications };
    delete rest[volunteerId];
    shift.certifications = rest;
  }
}

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

/** Port: what deployment planning needs to know about volunteers. */
export interface VolunteerDirectory {
  exists(volunteerId: string): Promise<boolean>;
  isQualified(volunteerId: string, skill: SkillName, onDate: string): Promise<boolean>;
  /** Local validity check (skill held, certification neither expired nor withdrawn); never calls the issuer. */
  hasValidCertification(volunteerId: string, skill: SkillName, onDate: string): Promise<boolean>;
  /** The certification (number and expiry) the volunteer holds for the skill, if any. */
  certificationFor(volunteerId: string, skill: SkillName): Promise<CertificationRef | undefined>;
  list(): Promise<VolunteerSummary[]>;
}

export interface VolunteerSummary {
  id: string;
  name: string;
  homeRegion: string;
}

export { buildImpactReport, buildServiceRecord, type ImpactReport, type ServiceRecord } from "./report.js";

export function shiftStart(s: Shift): number {
  return Date.parse(s.date + "T00:00:00Z") + s.startHour * 3_600_000;
}
