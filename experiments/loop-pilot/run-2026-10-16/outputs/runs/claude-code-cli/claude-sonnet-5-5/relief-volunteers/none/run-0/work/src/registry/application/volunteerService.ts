import { randomUUID } from "node:crypto";
import {
  addSkill,
  createVolunteerSkill,
  DomainError,
  isCertificationValid,
  type Certification,
  type CertificateVerifier,
  type Skill,
  type Volunteer,
  type VolunteerRepository,
} from "../domain/volunteer.js";

export class NotFoundError extends Error {}

export interface RegisterVolunteerCommand {
  name: string;
  contact: string;
  homeRegion: string;
}

/** Notified after a volunteer loses a certification (e.g. withdrawn). */
export type CertificationLostListener = (volunteerId: string, skill: Skill) => Promise<void>;

export class VolunteerService {
  private readonly lostListeners: CertificationLostListener[] = [];

  constructor(
    private readonly repo: VolunteerRepository,
    private readonly verifier: CertificateVerifier,
  ) {}

  register(cmd: RegisterVolunteerCommand): Volunteer {
    const v: Volunteer = { id: randomUUID(), ...cmd, skills: [] };
    this.repo.save(v);
    return v;
  }

  list(): Volunteer[] {
    return this.repo.findAll();
  }

  get(id: string): Volunteer {
    const v = this.repo.findById(id);
    if (!v) throw new NotFoundError(`Volunteer ${id} not found`);
    return v;
  }

  addSkill(id: string, skill: Skill, certification?: Certification): Volunteer {
    const v = this.get(id);
    addSkill(v, createVolunteerSkill(skill, certification));
    this.repo.save(v);
    return v;
  }

  onCertificationLost(listener: CertificationLostListener): void {
    this.lostListeners.push(listener);
  }

  async withdrawCertification(id: string, skill: Skill): Promise<Volunteer> {
    const v = this.get(id);
    const s = v.skills.find((x) => x.skill === skill);
    if (!s || !s.certification) throw new DomainError(`Volunteer has no certification for ${skill}`);
    s.certification.withdrawn = true;
    this.repo.save(v);
    for (const l of this.lostListeners) await l(id, skill);
    return v;
  }

  /**
   * Local check (no issuer call): the volunteer holds the skill and any
   * attached certification is valid on the date.
   */
  hasValidCertification(id: string, skill: Skill, onDate: string): boolean {
    const s = this.repo.findById(id)?.skills.find((x) => x.skill === skill);
    if (!s) return false;
    return !s.certification || isCertificationValid(s.certification, onDate);
  }

  /**
   * Daily job: re-checks every attached certification (any skill) with its
   * issuer. Unconfirmed ones lapse; ones confirmed again are restored.
   * Withdrawn certifications stay withdrawn.
   */
  async reverifyAll(): Promise<void> {
    await this.verifier.refresh?.();
    for (const v of this.repo.findAll()) {
      for (const s of v.skills) {
        const c = s.certification;
        if (!c || c.withdrawn) continue;
        const ok = await this.verifier.isConfirmed(s.skill, c.number);
        const current = this.repo.findById(v.id)?.skills.find((x) => x.skill === s.skill)?.certification;
        if (!current || current.withdrawn || current.number !== c.number) continue;
        if (ok) {
          if (current.lapsed) {
            delete current.lapsed;
            this.repo.save(v);
          }
        } else if (!current.lapsed) {
          current.lapsed = true;
          this.repo.save(v);
          for (const l of this.lostListeners) await l(v.id, s.skill);
        }
      }
    }
  }

  summaries(): { id: string; name: string; homeRegion: string }[] {
    return this.repo.findAll().map((v) => ({ id: v.id, name: v.name, homeRegion: v.homeRegion }));
  }

  /**
   * True when the volunteer holds the skill and, if a certification is
   * attached, it is unexpired on the given date and confirmed by its issuer.
   */
  async isQualified(id: string, skill: Skill, onDate: string): Promise<boolean> {
    const v = this.repo.findById(id);
    const s = v?.skills.find((x) => x.skill === skill);
    if (!s) return false;
    if (!s.certification) return true;
    if (!isCertificationValid(s.certification, onDate)) return false;
    return this.verifier.isConfirmed(skill, s.certification.number);
  }

  /** The certification a volunteer holds for a skill, if any. */
  certificationOf(id: string, skill: Skill): { number: string; expiresOn: string } | undefined {
    const c = this.repo.findById(id)?.skills.find((x) => x.skill === skill)?.certification;
    return c ? { number: c.number, expiresOn: c.expiresOn } : undefined;
  }

  async exists(id: string): Promise<boolean> {
    return this.repo.findById(id) !== undefined;
  }
}

export { DomainError };
