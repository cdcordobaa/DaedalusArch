import { Allocation, Gardener, Plot, isActive } from '../../domain/garden';
import {
  AllocationRepository,
  GardenerRepository,
  MeterRepository,
  PlotRepository,
  ReadingRepository,
  WaitingList,
  WorkDayRepository,
} from '../../application/ports';
import { WorkDay } from '../../domain/work-day';
import { MeterReading } from '../../domain/water';

export class InMemoryPlotRepository implements PlotRepository {
  private readonly plots = new Map<number, Plot>();
  save(plot: Plot): void {
    this.plots.set(plot.number, plot);
  }
  find(number: number): Plot | undefined {
    return this.plots.get(number);
  }
  all(): Plot[] {
    return [...this.plots.values()].sort((a, b) => a.number - b.number);
  }
}

export class InMemoryGardenerRepository implements GardenerRepository {
  private readonly items = new Map<string, Gardener>();
  save(g: Gardener): void {
    this.items.set(g.id, g);
  }
  find(id: string): Gardener | undefined {
    return this.items.get(id);
  }
  all(): Gardener[] {
    return [...this.items.values()];
  }
}

export class InMemoryAllocationRepository implements AllocationRepository {
  private readonly items = new Map<string, Allocation>();
  save(a: Allocation): void {
    this.items.set(a.id, a);
  }
  find(id: string): Allocation | undefined {
    return this.items.get(id);
  }
  findByPaymentRef(ref: string): Allocation | undefined {
    return [...this.items.values()].find((a) => a.paymentRef === ref);
  }
  active(): Allocation[] {
    return [...this.items.values()].filter(isActive);
  }
}

export class InMemoryWaitingList implements WaitingList {
  private queue: string[] = [];
  enqueue(gardenerId: string): void {
    if (!this.queue.includes(gardenerId)) this.queue.push(gardenerId);
  }
  remove(gardenerId: string): void {
    this.queue = this.queue.filter((id) => id !== gardenerId);
  }
  first(): string | undefined {
    return this.queue[0];
  }
  all(): string[] {
    return [...this.queue];
  }
}

export class InMemoryMeterRepository implements MeterRepository {
  private readonly links = new Map<string, number>();
  link(meterId: string, plotNumber: number): void {
    this.links.set(meterId, plotNumber);
  }
  plotFor(meterId: string): number | undefined {
    return this.links.get(meterId);
  }
}

export class InMemoryReadingRepository implements ReadingRepository {
  private readonly readings: MeterReading[] = [];
  add(r: MeterReading): void {
    this.readings.push(r);
  }
  forPlot(plotNumber: number): MeterReading[] {
    return this.readings.filter((r) => r.plotNumber === plotNumber);
  }
}

export class InMemoryWorkDayRepository implements WorkDayRepository {
  private readonly items = new Map<string, WorkDay>();
  save(d: WorkDay): void {
    this.items.set(d.id, d);
  }
  find(id: string): WorkDay | undefined {
    return this.items.get(id);
  }
  all(): WorkDay[] {
    return [...this.items.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}
