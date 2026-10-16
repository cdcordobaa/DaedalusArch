import { VolunteerDirectory } from "../domain/ports";
import { RegistryService } from "../../registry/application/registry-service";
import { isSkill, SKILLS } from "../../registry/domain/volunteer";

/** Anti-corruption layer: translates the registry context's model into deployment's VolunteerDirectory. */
export class RegistryVolunteerDirectory implements VolunteerDirectory {
  constructor(private readonly registry: RegistryService) {}

  exists(volunteerId: string): boolean {
    return this.registry.get(volunteerId) !== undefined;
  }

  homeRegion(volunteerId: string): string | undefined {
    return this.registry.get(volunteerId)?.homeRegion;
  }

  certification(volunteerId: string, skill: string): { number: string; expiry: string } | undefined {
    if (!isSkill(skill)) return undefined;
    const c = this.registry.get(volunteerId)?.skill(skill)?.certification;
    return c ? { number: c.number, expiry: c.expiry } : undefined;
  }

  skillNames(): string[] {
    return [...SKILLS];
  }

  async isQualified(volunteerId: string, skill: string, onDate: string): Promise<boolean> {
    if (!isSkill(skill)) return false;
    return this.registry.isQualified(volunteerId, skill, onDate);
  }

  async qualifiedVolunteers(skill: string, onDate: string): Promise<{ id: string; name: string }[]> {
    if (!isSkill(skill)) return [];
    return (await this.registry.qualifiedVolunteers(skill, onDate)).map((v) => ({ id: v.id, name: v.name }));
  }
}
