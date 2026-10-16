import { MeterReading, WEEKLY_WARNING_LITRES, weekStart, weeklyUse } from '../domain/water';
import { layoutEmail } from './email-layout';
import { AllocationRepository, GardenerRepository, Mailer, MeterRepository, ReadingRepository } from './ports';

export class WaterService {
  private readonly warned = new Set<string>();

  constructor(
    private readonly meters: MeterRepository,
    private readonly readings: ReadingRepository,
    private readonly allocations: AllocationRepository,
    private readonly gardeners: GardenerRepository,
    private readonly mailer: Mailer,
  ) {}

  linkMeter(meterId: string, plotNumber: number): void {
    this.meters.link(meterId, plotNumber);
  }

  recordReading(meterId: string, litres: number, time: string): MeterReading {
    const plotNumber = this.meters.plotFor(meterId);
    if (plotNumber === undefined) throw new Error(`Meter ${meterId} is not linked to a plot`);
    const reading: MeterReading = { meterId, plotNumber, litres, time };
    this.readings.add(reading);
    this.checkWeeklyUse(plotNumber, weekStart(new Date(time)));
    return reading;
  }

  weeklyUseForPlot(plotNumber: number): Record<string, number> {
    return weeklyUse(this.readings.forPlot(plotNumber));
  }

  private checkWeeklyUse(plotNumber: number, week: string): void {
    const used = this.weeklyUseForPlot(plotNumber)[week] ?? 0;
    const key = `${plotNumber}:${week}`;
    if (used <= WEEKLY_WARNING_LITRES || this.warned.has(key)) return;
    const allocation = this.allocations.active().find((a) => a.plotNumber === plotNumber);
    const gardener = allocation ? this.gardeners.find(allocation.gardenerId) : undefined;
    if (!gardener) return;
    this.warned.add(key);
    const mail = layoutEmail(gardener.name, `High water use on plot ${plotNumber}`, [
      `Your plot used ${used} litres in the week of ${week}, above the ${WEEKLY_WARNING_LITRES} litre limit.`,
    ]);
    this.mailer.send(gardener.email, mail.subject, mail.body);
  }
}
