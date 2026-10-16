import type { VolunteerService } from "../../registry/application/volunteerService.js";
import type { CertificationRef, SkillName, VolunteerDirectory, VolunteerSummary } from "../domain/deployment.js";
import { isSkill } from "../../registry/domain/volunteer.js";

/**
 * Anti-corruption layer: translates deployment's questions about volunteers
 * into calls on the registry context's application service, so deployment
 * never touches registry domain objects.
 */
export class RegistryVolunteerDirectory implements VolunteerDirectory {
  constructor(private readonly registry: VolunteerService) {}

  exists(volunteerId: string): Promise<boolean> {
    return this.registry.exists(volunteerId);
  }

  async isQualified(volunteerId: string, skill: SkillName, onDate: string): Promise<boolean> {
    if (!isSkill(skill)) return false;
    return this.registry.isQualified(volunteerId, skill, onDate);
  }

  async hasValidCertification(volunteerId: string, skill: SkillName, onDate: string): Promise<boolean> {
    if (!isSkill(skill)) return false;
    return this.registry.hasValidCertification(volunteerId, skill, onDate);
  }

  async certificationFor(volunteerId: string, skill: SkillName): Promise<CertificationRef | undefined> {
    if (!isSkill(skill)) return undefined;
    return this.registry.certificationOf(volunteerId, skill);
  }

  async list(): Promise<VolunteerSummary[]> {
    return this.registry.summaries();
  }
}
