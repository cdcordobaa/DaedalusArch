import { randomUUID } from 'node:crypto';
import { Allocation, Gardener, Plot, feeFor, isActive, isPaymentOverdue } from '../domain/garden';
import { attendedInPastYear, feeWithSurcharge } from '../domain/work-day';
import { AllocationRepository, Clock, GardenerRepository, Mailer, PaymentProvider, PlotRepository, WaitingList, WorkDayRepository } from './ports';
import { layoutEmail } from './email-layout';

export class GardenService {
  constructor(
    private readonly plots: PlotRepository,
    private readonly gardeners: GardenerRepository,
    private readonly allocations: AllocationRepository,
    private readonly waitingList: WaitingList,
    private readonly payments: PaymentProvider,
    private readonly clock: Clock,
    private readonly workDays: WorkDayRepository,
    private readonly mailer: Mailer,
  ) {}

  definePlot(plot: Plot): Plot {
    if (this.plots.find(plot.number)) throw new Error(`Plot ${plot.number} already exists`);
    if (plot.sizeM2 <= 0) throw new Error('size must be positive');
    this.plots.save(plot);
    return plot;
  }

  listPlots(): Plot[] {
    return this.plots.all();
  }

  apply(name: string, email: string): { gardener: Gardener; position: number } {
    const gardener: Gardener = { id: randomUUID(), name, email, appliedAt: this.clock.now().toISOString() };
    this.gardeners.save(gardener);
    this.waitingList.enqueue(gardener.id);
    return { gardener, position: this.waitingList.all().length };
  }

  freePlots(): Plot[] {
    const taken = new Set(this.allocations.active().map((a) => a.plotNumber));
    return this.plots.all().filter((p) => !taken.has(p.number));
  }

  waiting(): Gardener[] {
    return this.waitingList.all().map((id) => this.gardeners.find(id)).filter((g): g is Gardener => !!g);
  }

  async allocate(plotNumber: number): Promise<Allocation> {
    const plot = this.plots.find(plotNumber);
    if (!plot) throw new Error(`Plot ${plotNumber} not found`);
    if (!this.freePlots().some((p) => p.number === plotNumber)) throw new Error(`Plot ${plotNumber} is not free`);
    const gardenerId = this.waitingList.first();
    if (!gardenerId) throw new Error('Waiting list is empty');
    if (this.allocations.active().some((a) => a.gardenerId === gardenerId)) {
      this.waitingList.remove(gardenerId);
      throw new Error('Gardener already holds a plot');
    }
    const allocation: Allocation = {
      id: randomUUID(),
      plotNumber,
      gardenerId,
      allocatedAt: this.clock.now().toISOString(),
      fee: feeWithSurcharge(feeFor(plot), attendedInPastYear(this.workDays.all(), gardenerId, this.clock.now())),
      status: 'awaiting-payment',
      paymentRef: randomUUID(),
    };
    allocation.paymentLink = await this.payments.createPaymentLink(
      allocation.paymentRef as string,
      allocation.fee,
      `Plot ${plotNumber} yearly fee`,
    );
    this.waitingList.remove(gardenerId);
    this.allocations.save(allocation);
    const gardener = this.gardeners.find(gardenerId);
    if (gardener) {
      const mail = layoutEmail(gardener.name, `Plot ${plotNumber} is offered to you`, [
        `Plot ${plotNumber} (${plot.sizeM2} m2${plot.raisedBed ? ', raised bed' : ''}) is now yours.`,
        `Please pay the yearly fee of ${allocation.fee} within 14 days: ${allocation.paymentLink}`,
      ]);
      this.mailer.send(gardener.email, mail.subject, mail.body);
    }
    return allocation;
  }

  recordPayment(paymentRef: string, status: string): Allocation | undefined {
    const a = this.allocations.findByPaymentRef(paymentRef);
    if (!a) return undefined;
    if (a.status === 'paid' || a.status === 'released') return a;
    const normalized = status.toLowerCase();
    if (normalized === 'paid' || normalized === 'succeeded') {
      const paid: Allocation = { ...a, status: 'paid' };
      this.allocations.save(paid);
      return paid;
    }
    if (normalized === 'failed' || normalized === 'declined' || normalized === 'expired') {
      const failed: Allocation = { ...a, status: 'payment-failed' };
      this.allocations.save(failed);
      return failed;
    }
    return a;
  }

  /** Releases unpaid allocations past the deadline and offers the plot to the next gardener. */
  async releaseOverdue(): Promise<Allocation[]> {
    const now = this.clock.now();
    const released: Allocation[] = [];
    for (const a of this.allocations.active()) {
      if (isPaymentOverdue(a, now)) {
        this.allocations.save({ ...a, status: 'released' });
        released.push(a);
        if (this.waitingList.first()) await this.allocate(a.plotNumber);
      }
    }
    return released;
  }

  listAllocations(): Allocation[] {
    return this.allocations.active().filter(isActive);
  }
}
