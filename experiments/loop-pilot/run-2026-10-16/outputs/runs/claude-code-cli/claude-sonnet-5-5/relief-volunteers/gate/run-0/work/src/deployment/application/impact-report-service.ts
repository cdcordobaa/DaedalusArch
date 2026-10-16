import { DeploymentError, Incident, Shift } from "../domain/incident";
import { IncidentRepository, ShiftRepository, VolunteerDirectory } from "../domain/ports";
import { DeploymentService } from "./deployment-service";

export interface ImpactRow {
  hoursBySkill: Record<string, number>;
  totalHours: number;
  distinctVolunteers: number;
  volunteersByHomeRegion: Record<string, number>;
  placesNeeded: number;
  placesFilled: number;
  /** placesFilled / placesNeeded (0..1); null when there are no places. */
  fillShare: number | null;
}

export interface IncidentImpact extends ImpactRow {
  incidentId: string;
  incidentName: string;
  region: string;
}

export interface RegionImpact extends ImpactRow {
  region: string;
}

export interface ImpactReport {
  month: string;
  incidents: IncidentImpact[];
  regions: RegionImpact[];
}

export interface ServiceRecordEntry {
  shiftId: string;
  incidentId: string;
  incidentName: string;
  region: string;
  date: string;
  startTime: string;
  hours: number;
  skill: string;
  certification: { number: string; expiry: string } | null;
}

export interface ServiceRecord {
  volunteerId: string;
  month: string | null;
  totalHours: number;
  entries: ServiceRecordEntry[];
}

export function isMonth(v: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** A shift counts as served once it has ended. */
function served(s: Shift, nowMs: number): boolean {
  return s.endMs <= nowMs;
}

export class ImpactReportService {
  constructor(
    private readonly deployment: DeploymentService,
    private readonly incidents: IncidentRepository,
    private readonly shifts: ShiftRepository,
    private readonly volunteers: VolunteerDirectory,
  ) {}

  /** Hours and volunteers count shifts that have ended; places filled cover every shift starting in the month. */
  async monthlyReport(month: string, nowMs: number = Date.now()): Promise<ImpactReport> {
    if (!isMonth(month)) throw new DeploymentError("month must be YYYY-MM");
    const perIncident: { incident: Incident; shifts: Shift[] }[] = [];
    for (const incident of this.incidents.findAll()) {
      const inMonth = (await this.deployment.listShifts(incident.id)).filter((s) => s.date.startsWith(month));
      if (inMonth.length > 0) perIncident.push({ incident, shifts: inMonth });
    }
    const incidents = perIncident.map(({ incident, shifts }) => ({
      incidentId: incident.id,
      incidentName: incident.name,
      region: incident.region,
      ...this.summarise(shifts, nowMs),
    }));
    const regionNames = [...new Set(perIncident.map((p) => p.incident.region))].sort();
    const regions = regionNames.map((region) => ({
      region,
      ...this.summarise(
        perIncident.filter((p) => p.incident.region === region).flatMap((p) => p.shifts),
        nowMs,
      ),
    }));
    return { month, incidents, regions };
  }

  private summarise(shifts: Shift[], nowMs: number): ImpactRow {
    const hoursBySkill: Record<string, number> = {};
    for (const name of this.volunteers.skillNames()) hoursBySkill[name] = 0;
    const people = new Set<string>();
    let placesNeeded = 0;
    let placesFilled = 0;
    for (const s of shifts) {
      placesNeeded += s.peopleNeeded;
      placesFilled += s.volunteers.length;
      if (!served(s, nowMs)) continue;
      hoursBySkill[s.requiredSkill] = (hoursBySkill[s.requiredSkill] ?? 0) + s.hours * s.volunteers.length;
      for (const v of s.volunteers) people.add(v);
    }
    const volunteersByHomeRegion: Record<string, number> = {};
    for (const v of people) {
      const r = this.volunteers.homeRegion(v) ?? "unknown";
      volunteersByHomeRegion[r] = (volunteersByHomeRegion[r] ?? 0) + 1;
    }
    return {
      hoursBySkill,
      totalHours: Object.values(hoursBySkill).reduce((a, b) => a + b, 0),
      distinctVolunteers: people.size,
      volunteersByHomeRegion,
      placesNeeded,
      placesFilled,
      fillShare: placesNeeded === 0 ? null : Math.round((placesFilled / placesNeeded) * 10000) / 10000,
    };
  }

  /** A volunteer's own record of served shifts, optionally limited to one month. */
  serviceRecord(volunteerId: string, month?: string, nowMs: number = Date.now()): ServiceRecord {
    if (!this.volunteers.exists(volunteerId)) throw new DeploymentError(`Volunteer ${volunteerId} not found`, "not_found");
    if (month !== undefined && !isMonth(month)) throw new DeploymentError("month must be YYYY-MM");
    const entries: ServiceRecordEntry[] = [];
    for (const s of this.shifts.findByVolunteer(volunteerId)) {
      if (!served(s, nowMs) || (month !== undefined && !s.date.startsWith(month))) continue;
      const incident = this.incidents.findById(s.incidentId);
      entries.push({
        shiftId: s.id,
        incidentId: s.incidentId,
        incidentName: incident?.name ?? "",
        region: incident?.region ?? "",
        date: s.date,
        startTime: s.startTime,
        hours: s.hours,
        skill: s.requiredSkill,
        certification: s.certificationOf(volunteerId),
      });
    }
    entries.sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
    return { volunteerId, month: month ?? null, totalHours: entries.reduce((a, e) => a + e.hours, 0), entries };
  }
}
