export const SKILLS = ["first_aid", "heavy_machinery", "logistics", "translation"] as const;
export type Skill = (typeof SKILLS)[number];

export function isSkill(v: unknown): v is Skill {
  return typeof v === "string" && (SKILLS as readonly string[]).includes(v);
}

/** Skills for which a certification is mandatory. */
export const CERTIFICATION_REQUIRED: readonly Skill[] = ["first_aid"];

export class DomainError extends Error {}

export interface Certification {
  number: string;
  expiry: string; // YYYY-MM-DD
  withdrawn?: boolean;
}

export interface VolunteerSkill {
  skill: Skill;
  certification?: Certification;
}

export function isDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

export class Volunteer {
  private readonly _skills = new Map<Skill, VolunteerSkill>();

  constructor(
    readonly id: string,
    readonly name: string,
    readonly contact: string,
    readonly homeRegion: string,
  ) {}

  get skills(): VolunteerSkill[] {
    return [...this._skills.values()];
  }

  skill(skill: Skill): VolunteerSkill | undefined {
    return this._skills.get(skill);
  }

  addSkill(skill: Skill, certification?: Certification): void {
    if (CERTIFICATION_REQUIRED.includes(skill) && !certification) {
      throw new DomainError(`Skill ${skill} requires a certification (number and expiry)`);
    }
    if (certification) {
      if (!certification.number.trim()) throw new DomainError("Certification number is required");
      if (!isDate(certification.expiry)) throw new DomainError("Certification expiry must be YYYY-MM-DD");
    }
    this._skills.set(skill, { skill, certification });
  }

  withdrawCertification(skill: Skill): void {
    const s = this._skills.get(skill);
    if (!s?.certification) throw new DomainError(`Volunteer has no certification for ${skill}`);
    this._skills.set(skill, { skill, certification: { ...s.certification, withdrawn: true } });
  }
}
