import { randomUUID } from "node:crypto";
import { CertificateVerifier, LicenceRegistry, VolunteerRepository } from "../domain/ports";
import { Certification, DomainError, Skill, Volunteer, VolunteerSkill } from "../domain/volunteer";

export interface SkillStatus extends VolunteerSkill {
  /** false when a required/provided certification is unconfirmed or expired: counts as missing. */
  valid: boolean;
}

export type QualificationListener = (volunteerId: string) => Promise<void>;

export class RegistryService {
  private readonly listeners: QualificationListener[] = [];

  constructor(
    private readonly repo: VolunteerRepository,
    private readonly verifier: CertificateVerifier,
    private readonly licences: LicenceRegistry,
  ) {}

  register(input: { name: string; contact: string; homeRegion: string }): Volunteer {
    const v = new Volunteer(randomUUID(), input.name, input.contact, input.homeRegion);
    this.repo.save(v);
    return v;
  }

  list(): Volunteer[] {
    return this.repo.findAll();
  }

  get(id: string): Volunteer | undefined {
    return this.repo.findById(id);
  }

  /** Registers a callback invoked after a volunteer's skills or certifications changed. */
  onQualificationChanged(listener: QualificationListener): void {
    this.listeners.push(listener);
  }

  async addSkill(id: string, skill: Skill, certification?: Certification): Promise<Volunteer | undefined> {
    const v = this.repo.findById(id);
    if (!v) return undefined;
    v.addSkill(skill, certification);
    this.repo.save(v);
    await this.notify(id);
    return v;
  }

  async withdrawCertification(id: string, skill: Skill): Promise<Volunteer | undefined> {
    const v = this.repo.findById(id);
    if (!v) return undefined;
    v.withdrawCertification(skill);
    this.repo.save(v);
    await this.notify(id);
    return v;
  }

  /** Volunteers holding the skill with a valid certification on the given date. */
  async qualifiedVolunteers(skill: Skill, onDate: string): Promise<Volunteer[]> {
    const all = this.repo.findAll();
    const flags = await Promise.all(all.map((v) => this.isQualified(v.id, skill, onDate)));
    return all.filter((_, i) => flags[i]);
  }

  private async notify(id: string): Promise<void> {
    for (const l of this.listeners) await l(id);
  }

  async skillStatuses(id: string, onDate: string = today()): Promise<SkillStatus[] | undefined> {
    const v = this.repo.findById(id);
    if (!v) return undefined;
    return Promise.all(v.skills.map(async (s) => ({ ...s, valid: await this.isValid(s, onDate) })));
  }

  /** True when the volunteer holds the skill with a valid (unexpired, issuer-confirmed where applicable) certification. */
  async isQualified(id: string, skill: Skill, onDate: string): Promise<boolean> {
    const v = this.repo.findById(id);
    if (!v) throw new DomainError(`Unknown volunteer ${id}`);
    const s = v.skill(skill);
    return s ? this.isValid(s, onDate) : false;
  }

  private async isValid(s: VolunteerSkill, onDate: string): Promise<boolean> {
    if (!s.certification) return true;
    if (s.certification.withdrawn) return false;
    if (s.certification.expiry < onDate) return false;
    if (s.skill === "first_aid") return this.verifier.isConfirmed(s.certification.number);
    if (s.skill === "heavy_machinery") return this.licences.isListed(s.certification.number);
    return true;
  }

  /** Daily job: refreshes the licence list, re-verifies every certification and reconciles affected deployments. */
  async reverifyAll(onDate: string = today()): Promise<void> {
    await this.licences.refresh();
    for (const v of this.repo.findAll()) {
      let hasCertification = false;
      for (const s of v.skills) {
        if (!s.certification) continue;
        hasCertification = true;
        await this.isValid(s, onDate);
      }
      if (hasCertification) await this.notify(v.id);
    }
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
