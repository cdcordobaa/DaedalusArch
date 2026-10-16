import { Allocation, Gardener, Plot } from '../domain/garden';

export interface PlotRepository {
  save(plot: Plot): void;
  find(number: number): Plot | undefined;
  all(): Plot[];
}

export interface GardenerRepository {
  save(g: Gardener): void;
  find(id: string): Gardener | undefined;
  all(): Gardener[];
}

export interface AllocationRepository {
  save(a: Allocation): void;
  find(id: string): Allocation | undefined;
  findByPaymentRef(ref: string): Allocation | undefined;
  active(): Allocation[];
}

export interface WaitingList {
  enqueue(gardenerId: string): void;
  remove(gardenerId: string): void;
  first(): string | undefined;
  all(): string[];
}

export interface PaymentProvider {
  createPaymentLink(reference: string, amount: number, description: string): Promise<string>;
}

export interface Clock {
  now(): Date;
}
