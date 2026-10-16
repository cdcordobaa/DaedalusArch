import { randomUUID } from "node:crypto";
import {
  assignVolunteer,
  buildImpactReport,
  buildServiceRecord,
  DomainError,
  isIsoDate,
  overlaps,
  shiftStart,
  unassignVolunteer,
  validateShift,
  type Incident,
  type IncidentRepository,
  type ImpactReport,
  type ServiceRecord,
  type Shift,
  type ShiftRepository,
  type SkillName,
  type VolunteerDirectory,
  type VolunteerSummary,
} from "../domain/deployment.js";

const isMonth = (m: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export class NotFoundError extends Error {}

export interface PlanShiftCommand {
  date: string;
  startHour: number;
  hours: number;
  requiredSkill: SkillName;
  peopleNeeded: number;
}

export class DeploymentService {
  constructor(
    private readonly incidents: IncidentRepository,
    private readonly shifts: ShiftRepository,
    private readonly directory: VolunteerDirectory,
    private readonly knownSkill: (s: string) => boolean,
  ) {}

  createIncident(name: string, region: string, startDate: string): Incident {
    if (!isIsoDate(startDate)) throw new DomainError("startDate must be YYYY-MM-DD");
    const i: Incident = { id: randomUUID(), name, region, startDate };
    this.incidents.save(i);
    return i;
  }

  listIncidents(): Incident[] {
    return this.incidents.findAll();
  }

  getIncident(id: string): Incident {
    const i = this.incidents.findById(id);
    if (!i) throw new NotFoundError(`Incident ${id} not found`);
    return i;
  }

  planShift(incidentId: string, cmd: PlanShiftCommand): Shift {
    this.getIncident(incidentId);
    validateShift(cmd);
    if (!this.knownSkill(cmd.requiredSkill)) throw new DomainError(`Unknown skill ${cmd.requiredSkill}`);
    const s: Shift = { id: randomUUID(), incidentId, ...cmd, volunteerIds: [] };
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
    const s = this.find(id);
    await this.releaseUnqualified([s]);
    return s;
  }

  private find(id: string): Shift {
    const s = this.shifts.findById(id);
    if (!s) throw new NotFoundError(`Shift ${id} not found`);
    return s;
  }

  /**
   * Releases volunteers from future shifts whose required certification is
   * expired or withdrawn on the shift date, so those shifts show as open again.
   */
  async releaseUnqualified(shifts: Shift[], now = Date.now()): Promise<void> {
    for (const shift of shifts) {
      if (shiftStart(shift) <= now) continue;
      for (const vid of [...shift.volunteerIds]) {
        if (await this.directory.hasValidCertification(vid, shift.requiredSkill, shift.date)) continue;
        const current = this.shifts.findById(shift.id);
        if (current?.volunteerIds.includes(vid)) {
          unassignVolunteer(current, vid);
          this.shifts.save(current);
        }
      }
    }
  }

  releaseForVolunteer(volunteerId: string): Promise<void> {
    return this.releaseUnqualified(this.shifts.findByVolunteer(volunteerId));
  }

  /** Shifts of the incident that still need people, with the volunteers who could fill each. */
  async openShifts(incidentId: string): Promise<(Shift & { openSlots: number; candidates: VolunteerSummary[] })[]> {
    const all = await this.listShifts(incidentId);
    const volunteers = await this.directory.list();
    const result: (Shift & { openSlots: number; candidates: VolunteerSummary[] })[] = [];
    for (const shift of all) {
      if (shift.volunteerIds.length >= shift.peopleNeeded) continue;
      const candidates: VolunteerSummary[] = [];
      for (const v of volunteers) {
        if (shift.volunteerIds.includes(v.id)) continue;
        if (!(await this.directory.isQualified(v.id, shift.requiredSkill, shift.date))) continue;
        if (this.shifts.findByVolunteer(v.id).some((o) => o.id !== shift.id && overlaps(o, shift))) continue;
        candidates.push(v);
      }
      result.push({ ...shift, openSlots: shift.peopleNeeded - shift.volunteerIds.length, candidates });
    }
    return result;
  }

  async assign(shiftId: string, volunteerId: string): Promise<Shift> {
    const pre = this.find(shiftId);
    if (!(await this.directory.exists(volunteerId))) throw new NotFoundError(`Volunteer ${volunteerId} not found`);
    if (!(await this.directory.isQualified(volunteerId, pre.requiredSkill, pre.date))) {
      throw new DomainError(`Volunteer lacks a valid, confirmed ${pre.requiredSkill} qualification`);
    }
    const cert = await this.directory.certificationFor(volunteerId, pre.requiredSkill);
    // Re-read and check invariants synchronously after the awaits so concurrent requests cannot interleave.
    const shift = this.find(shiftId);
    assignVolunteer(shift, volunteerId, this.shifts.findByVolunteer(volunteerId), cert);
    this.shifts.save(shift);
    return shift;
  }

  /** Monthly funder report; month is YYYY-MM. */
  async impactReport(month: string): Promise<ImpactReport> {
    if (!isMonth(month)) throw new DomainError("month must be YYYY-MM");
    const volunteers = await this.directory.list();
    const incidents = this.incidents.findAll();
    const shifts = incidents.flatMap((i) => this.shifts.findByIncident(i.id));
    return buildImpactReport(month, incidents, shifts, volunteers);
  }

  /** A volunteer's own service hours, optionally limited to a month (YYYY-MM). */
  async serviceRecord(volunteerId: string, month?: string): Promise<ServiceRecord> {
    if (month !== undefined && !isMonth(month)) throw new DomainError("month must be YYYY-MM");
    if (!(await this.directory.exists(volunteerId))) throw new NotFoundError(`Volunteer ${volunteerId} not found`);
    return buildServiceRecord(volunteerId, month, this.incidents.findAll(), this.shifts.findByVolunteer(volunteerId));
  }

  unassign(shiftId: string, volunteerId: string): Shift {
    const shift = this.find(shiftId);
    unassignVolunteer(shift, volunteerId);
    this.shifts.save(shift);
    return shift;
  }
}
