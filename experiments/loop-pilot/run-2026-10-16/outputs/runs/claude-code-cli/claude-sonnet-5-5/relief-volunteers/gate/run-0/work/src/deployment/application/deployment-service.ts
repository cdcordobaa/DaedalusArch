import { randomUUID } from "node:crypto";
import { DeploymentError, Incident, Shift } from "../domain/incident";
import { IncidentRepository, ShiftRepository, VolunteerDirectory } from "../domain/ports";

export class DeploymentService {
  constructor(
    private readonly incidents: IncidentRepository,
    private readonly shifts: ShiftRepository,
    private readonly volunteers: VolunteerDirectory,
  ) {}

  createIncident(input: { name: string; region: string; startDate: string }): Incident {
    const i = new Incident(randomUUID(), input.name, input.region, input.startDate);
    this.incidents.save(i);
    return i;
  }

  listIncidents(): Incident[] {
    return this.incidents.findAll();
  }

  getIncident(id: string): Incident {
    const i = this.incidents.findById(id);
    if (!i) throw new DeploymentError(`Incident ${id} not found`, "not_found");
    return i;
  }

  addShift(incidentId: string, input: { date: string; startTime: string; hours: number; requiredSkill: string; peopleNeeded: number }): Shift {
    this.getIncident(incidentId);
    const s = new Shift(randomUUID(), incidentId, input.date, input.startTime, input.hours, input.requiredSkill, input.peopleNeeded);
    this.shifts.save(s);
    return s;
  }

  async listShifts(incidentId: string): Promise<Shift[]> {
    this.getIncident(incidentId);
    const list = this.shifts.findByIncident(incidentId);
    await this.releaseUnqualified(list);
    return list;
  }

  async getShift(id: string): Promise<Shift> {
    const s = this.findShift(id);
    await this.releaseUnqualified([s]);
    return s;
  }

  private findShift(id: string): Shift {
    const s = this.shifts.findById(id);
    if (!s) throw new DeploymentError(`Shift ${id} not found`, "not_found");
    return s;
  }

  /** Open shifts of an incident (not fully staffed) with the volunteers who could fill each. */
  async listOpenShifts(incidentId: string): Promise<{ shift: Shift; openSlots: number; candidates: { id: string; name: string }[] }[]> {
    const all = await this.listShifts(incidentId);
    return Promise.all(
      all
        .filter((s) => !s.isFull())
        .map(async (shift) => {
          const qualified = await this.volunteers.qualifiedVolunteers(shift.requiredSkill, shift.date);
          const candidates = qualified.filter(
            (v) => !shift.volunteers.includes(v.id) && !this.shifts.findByVolunteer(v.id).some((o) => o.id !== shift.id && o.overlaps(shift)),
          );
          return { shift, openSlots: shift.peopleNeeded - shift.volunteers.length, candidates };
        }),
    );
  }

  /** Re-checks a volunteer's future shifts after their qualifications changed. */
  async reconcileVolunteer(volunteerId: string): Promise<void> {
    await this.releaseUnqualified(this.shifts.findByVolunteer(volunteerId), volunteerId);
  }

  /** Releases volunteers from future shifts whose required skill they no longer validly hold on the shift date. */
  private async releaseUnqualified(shifts: Shift[], onlyVolunteer?: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    for (const shift of shifts) {
      if (shift.date < today) continue;
      for (const vid of [...shift.volunteers]) {
        if (onlyVolunteer !== undefined && vid !== onlyVolunteer) continue;
        if (await this.volunteers.isQualified(vid, shift.requiredSkill, shift.date)) continue;
        if (shift.volunteers.includes(vid)) {
          shift.unassign(vid);
          this.shifts.save(shift);
        }
      }
    }
  }

  async assign(shiftId: string, volunteerId: string): Promise<Shift> {
    const shift = await this.getShift(shiftId);
    if (!this.volunteers.exists(volunteerId)) throw new DeploymentError(`Volunteer ${volunteerId} not found`, "not_found");
    if (!(await this.volunteers.isQualified(volunteerId, shift.requiredSkill, shift.date))) {
      throw new DeploymentError(`Volunteer lacks a valid ${shift.requiredSkill} qualification for ${shift.date}`, "conflict");
    }
    // Invariant checks and mutation happen synchronously, after the async qualification lookup.
    shift.assign(volunteerId, this.shifts.findByVolunteer(volunteerId), this.volunteers.certification(volunteerId, shift.requiredSkill));
    this.shifts.save(shift);
    return shift;
  }

  unassign(shiftId: string, volunteerId: string): Shift {
    const shift = this.findShift(shiftId);
    shift.unassign(volunteerId);
    this.shifts.save(shift);
    return shift;
  }
}
