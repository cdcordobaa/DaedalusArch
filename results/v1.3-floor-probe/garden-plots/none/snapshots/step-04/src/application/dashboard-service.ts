import {
  AllocationRepository,
  Clock,
  GardenerRepository,
  PlotRepository,
  ReadingRepository,
  WaitingList,
  WorkDayRepository,
} from './ports';

export interface DashboardRow {
  plotNumber: number;
  gardener: string | null;
  feePaid: boolean | null;
  waterThisMonthLitres: number;
  workDaysThisYear: number;
}

export interface Dashboard {
  generatedAt: string;
  plots: DashboardRow[];
  waitingListLength: number;
}

/** Builds the committee dashboard in one pass over each store. */
export class DashboardService {
  constructor(
    private readonly plots: PlotRepository,
    private readonly allocations: AllocationRepository,
    private readonly gardeners: GardenerRepository,
    private readonly readings: ReadingRepository,
    private readonly workDays: WorkDayRepository,
    private readonly waitingList: WaitingList,
    private readonly clock: Clock,
  ) {}

  build(): Dashboard {
    const now = this.clock.now();
    const year = now.getUTCFullYear();
    const monthStart = new Date(Date.UTC(year, now.getUTCMonth(), 1)).toISOString();
    const nextMonth = new Date(Date.UTC(year, now.getUTCMonth() + 1, 1)).toISOString();

    const allocationByPlot = new Map(this.allocations.active().map((a) => [a.plotNumber, a]));
    const gardenerById = new Map(this.gardeners.all().map((g) => [g.id, g]));

    const waterByPlot = new Map<number, number>();
    for (const r of this.readings.between(monthStart, nextMonth)) {
      waterByPlot.set(r.plotNumber, (waterByPlot.get(r.plotNumber) ?? 0) + r.litres);
    }

    const attendance = new Map<string, number>();
    for (const d of this.workDays.all()) {
      if (!d.date.startsWith(String(year))) continue;
      for (const id of d.present) attendance.set(id, (attendance.get(id) ?? 0) + 1);
    }

    const rows: DashboardRow[] = this.plots.all().map((p) => {
      const a = allocationByPlot.get(p.number);
      const g = a ? gardenerById.get(a.gardenerId) : undefined;
      return {
        plotNumber: p.number,
        gardener: g?.name ?? null,
        feePaid: a ? a.status === 'paid' : null,
        waterThisMonthLitres: waterByPlot.get(p.number) ?? 0,
        workDaysThisYear: g ? attendance.get(g.id) ?? 0 : 0,
      };
    });

    return { generatedAt: now.toISOString(), plots: rows, waitingListLength: this.waitingList.all().length };
  }
}
