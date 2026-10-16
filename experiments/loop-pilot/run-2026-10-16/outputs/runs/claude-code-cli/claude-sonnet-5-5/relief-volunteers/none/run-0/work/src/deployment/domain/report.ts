import type { CertificationRef, Incident, Shift, SkillName, VolunteerSummary } from "./deployment.js";

export interface ReportLine {
  hoursBySkill: Record<SkillName, number>;
  distinctVolunteers: number;
  /** Places filled / places needed across the shifts, 0 when there are no shifts. */
  shiftPlacesFilledShare: number;
  placesNeeded: number;
  placesFilled: number;
  volunteersByHomeRegion: Record<string, number>;
}

export interface ImpactReport {
  month: string;
  incidents: (ReportLine & { incidentId: string; incidentName: string; region: string })[];
  regions: (ReportLine & { region: string })[];
}

export interface ServiceRecord {
  volunteerId: string;
  month?: string;
  totalHours: number;
  entries: {
    shiftId: string;
    incidentId: string;
    incidentName: string;
    region: string;
    date: string;
    startHour: number;
    hours: number;
    skill: SkillName;
    certification: CertificationRef | null;
  }[];
}

function line(shifts: Shift[], homeRegion: Map<string, string>): ReportLine {
  const hoursBySkill: Record<string, number> = {};
  const people = new Set<string>();
  let needed = 0;
  let filled = 0;
  for (const s of shifts) {
    needed += s.peopleNeeded;
    filled += s.volunteerIds.length;
    hoursBySkill[s.requiredSkill] = (hoursBySkill[s.requiredSkill] ?? 0) + s.hours * s.volunteerIds.length;
    for (const v of s.volunteerIds) people.add(v);
  }
  const byRegion: Record<string, number> = {};
  for (const v of people) {
    const r = homeRegion.get(v) ?? "unknown";
    byRegion[r] = (byRegion[r] ?? 0) + 1;
  }
  return {
    hoursBySkill,
    distinctVolunteers: people.size,
    shiftPlacesFilledShare: needed === 0 ? 0 : filled / needed,
    placesNeeded: needed,
    placesFilled: filled,
    volunteersByHomeRegion: byRegion,
  };
}

/** Shifts dated within the month count; hours served = shift hours x volunteers assigned. */
export function buildImpactReport(month: string, incidents: Incident[], shifts: Shift[], volunteers: VolunteerSummary[]): ImpactReport {
  const home = new Map(volunteers.map((v) => [v.id, v.homeRegion]));
  const inMonth = shifts.filter((s) => s.date.startsWith(month + "-"));
  const report: ImpactReport = { month, incidents: [], regions: [] };
  const regionNames = new Set<string>();
  for (const i of incidents) {
    const own = inMonth.filter((s) => s.incidentId === i.id);
    if (own.length === 0) continue;
    regionNames.add(i.region);
    report.incidents.push({ incidentId: i.id, incidentName: i.name, region: i.region, ...line(own, home) });
  }
  for (const region of regionNames) {
    const ids = new Set(incidents.filter((i) => i.region === region).map((i) => i.id));
    report.regions.push({ region, ...line(inMonth.filter((s) => ids.has(s.incidentId)), home) });
  }
  return report;
}

export function buildServiceRecord(volunteerId: string, month: string | undefined, incidents: Incident[], shifts: Shift[]): ServiceRecord {
  const byId = new Map(incidents.map((i) => [i.id, i]));
  const entries = shifts
    .filter((s) => month === undefined || s.date.startsWith(month + "-"))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour)
    .map((s) => ({
      shiftId: s.id,
      incidentId: s.incidentId,
      incidentName: byId.get(s.incidentId)?.name ?? "",
      region: byId.get(s.incidentId)?.region ?? "",
      date: s.date,
      startHour: s.startHour,
      hours: s.hours,
      skill: s.requiredSkill,
      certification: s.certifications?.[volunteerId] ?? null,
    }));
  const base = { volunteerId, totalHours: entries.reduce((t, e) => t + e.hours, 0), entries };
  return month === undefined ? base : { ...base, month };
}
