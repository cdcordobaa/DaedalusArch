import { Allocation, Gardener, Plot, isActive } from '../../domain/garden';
import { AllocationRepository, GardenerRepository, PlotRepository, WaitingList } from '../../application/ports';

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
