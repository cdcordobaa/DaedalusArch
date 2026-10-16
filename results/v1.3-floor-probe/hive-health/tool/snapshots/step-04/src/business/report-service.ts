import { DomainError, isFlagged } from './model';
import { HiveRepository, InspectionRepository } from '../persistence/hive-repository';
import { HarvestRepository, TreatmentRepository } from '../persistence/treatment-repository';

export interface RegionReport {
  region: string;
  hives: number;
  flaggedShare: number;
  treatmentsByProduct: Record<string, number>;
  honeyKg: number;
}

export function quarterRange(quarter: string): { from: string; to: string } {
  const m = /^(\d{4})-Q([1-4])$/.exec(quarter);
  if (!m) throw new DomainError('quarter must look like 2026-Q3');
  const year = Number(m[1]);
  const q = Number(m[2]);
  const from = new Date(Date.UTC(year, (q - 1) * 3, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, q * 3, 0)).toISOString().slice(0, 10);
  return { from, to };
}

export class ReportService {
  constructor(
    private readonly hives: HiveRepository,
    private readonly inspections: InspectionRepository,
    private readonly treatments: TreatmentRepository,
    private readonly harvests: HarvestRepository,
  ) {}

  quarterly(quarter: string): { quarter: string; from: string; to: string; regions: RegionReport[] } {
    const { from, to } = quarterRange(quarter);
    const regionOfApiary = new Map(this.hives.allApiaries().map((a) => [a.id, a.region]));
    const byRegion = new Map<string, RegionReport & { flagged: number }>();
    for (const hive of this.hives.allHives()) {
      const region = regionOfApiary.get(hive.apiaryId) ?? 'unknown';
      let r = byRegion.get(region);
      if (!r) {
        r = { region, hives: 0, flagged: 0, flaggedShare: 0, treatmentsByProduct: {}, honeyKg: 0 };
        byRegion.set(region, r);
      }
      r.hives++;
      const inspectionsToEnd = this.inspections.forHive(hive.id).filter((i) => i.date <= to);
      const treatmentsToEnd = this.treatments.forHive(hive.id).filter((t) => t.startDate <= to);
      if (isFlagged(inspectionsToEnd, treatmentsToEnd)) r.flagged++;
      for (const t of treatmentsToEnd.filter((x) => x.startDate >= from)) {
        r.treatmentsByProduct[t.product] = (r.treatmentsByProduct[t.product] ?? 0) + 1;
      }
      for (const h of this.harvests.forHive(hive.id)) if (h.date >= from && h.date <= to) r.honeyKg += h.kg;
    }
    const regions = [...byRegion.values()].map(({ flagged, ...r }) => ({
      ...r,
      flaggedShare: r.hives ? Math.round((flagged / r.hives) * 1000) / 1000 : 0,
      honeyKg: Math.round(r.honeyKg * 10) / 10,
    }));
    return { quarter, from, to, regions: regions.sort((a, b) => a.region.localeCompare(b.region)) };
  }
}
