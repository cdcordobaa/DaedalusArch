import type { Incident, IncidentRepository, Shift, ShiftRepository } from "../domain/deployment.js";

export class InMemoryIncidentRepository implements IncidentRepository {
  private readonly items = new Map<string, Incident>();

  save(i: Incident): void {
    this.items.set(i.id, i);
  }

  findById(id: string): Incident | undefined {
    return this.items.get(id);
  }

  findAll(): Incident[] {
    return [...this.items.values()];
  }
}

export class InMemoryShiftRepository implements ShiftRepository {
  private readonly items = new Map<string, Shift>();

  save(s: Shift): void {
    this.items.set(s.id, s);
  }

  findById(id: string): Shift | undefined {
    return this.items.get(id);
  }

  findByIncident(incidentId: string): Shift[] {
    return [...this.items.values()].filter((s) => s.incidentId === incidentId);
  }

  findByVolunteer(volunteerId: string): Shift[] {
    return [...this.items.values()].filter((s) => s.volunteerIds.includes(volunteerId));
  }
}
