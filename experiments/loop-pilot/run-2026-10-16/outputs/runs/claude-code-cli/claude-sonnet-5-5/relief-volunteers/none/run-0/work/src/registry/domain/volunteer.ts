export const SKILLS = ["first_aid", "heavy_machinery", "logistics", "translation"] as const;
export type Skill = (typeof SKILLS)[number];

export function isSkill(v: unknown): v is Skill {
  return typeof v === "string" && (SKILLS as readonly string[]).includes(v);
}

/** Skills that cannot be held without a certification. */
export const CERTIFICATION_REQUIRED: readonly Skill[] = ["first_aid"];

export class DomainError extends Error {}

export interface Certification {
  number: string;
  /** ISO date YYYY-MM-DD */
  expiresOn: string;
  /** Set when the certification was withdrawn. */
  withdrawn?: boolean;
  /** Set by the daily re-verification when the issuer no longer confirms it; cleared when confirmed again. */
  lapsed?: boolean;
}

export interface VolunteerSkill {
  skill: Skill;
  certification?: Certification;
}

export interface Volunteer {
  id: string;
  name: string;
  contact: string;
  homeRegion: string;
  skills: VolunteerSkill[];
}

export function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));
}

export function createVolunteerSkill(skill: Skill, certification?: Certification): VolunteerSkill {
  if (certification) {
    if (!certification.number.trim()) throw new DomainError("Certification number is required");
    if (!isIsoDate(certification.expiresOn)) throw new DomainError("Certification expiry must be YYYY-MM-DD");
  } else if (CERTIFICATION_REQUIRED.includes(skill)) {
    throw new DomainError(`Skill ${skill} requires a certification`);
  }
  return certification ? { skill, certification } : { skill };
}

export function addSkill(v: Volunteer, s: VolunteerSkill): void {
  v.skills = v.skills.filter((x) => x.skill !== s.skill);
  v.skills.push(s);
}

export function isExpired(c: Certification, on: string): boolean {
  return c.expiresOn < on;
}

/** A certification counts on a date when it is not withdrawn and not yet expired. */
export function isCertificationValid(c: Certification, on: string): boolean {
  return !c.withdrawn && !c.lapsed && !isExpired(c, on);
}

export interface VolunteerRepository {
  save(v: Volunteer): void;
  findById(id: string): Volunteer | undefined;
  findAll(): Volunteer[];
}

/** Port: asks the issuer whether a certificate is confirmed. */
export interface CertificateVerifier {
  isConfirmed(skill: Skill, certificateNumber: string): Promise<boolean>;
  /** Refreshes any cached issuer data (e.g. the daily licence file). */
  refresh?(): Promise<void>;
}
