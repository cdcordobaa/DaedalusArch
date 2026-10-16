import type { Volunteer, VolunteerRepository } from "../domain/volunteer.js";

export class InMemoryVolunteerRepository implements VolunteerRepository {
  private readonly items = new Map<string, Volunteer>();

  save(v: Volunteer): void {
    this.items.set(v.id, v);
  }

  findById(id: string): Volunteer | undefined {
    return this.items.get(id);
  }

  findAll(): Volunteer[] {
    return [...this.items.values()];
  }
}
