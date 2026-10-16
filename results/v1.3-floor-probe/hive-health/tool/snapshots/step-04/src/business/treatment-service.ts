import { randomUUID } from 'node:crypto';
import { DomainError, Harvest, Hive, Treatment, TreatmentProduct, harvestAllowedFrom, harvestBlockedBy } from './model';
import { HiveRepository } from '../persistence/hive-repository';
import { HarvestRepository, TreatmentRepository } from '../persistence/treatment-repository';

export class TreatmentService {
  constructor(private readonly hives: HiveRepository, private readonly treatments: TreatmentRepository, private readonly harvests: HarvestRepository) {}

  defineProduct(name: string, withdrawalDays: number): TreatmentProduct {
    if (!name || !(withdrawalDays >= 0)) throw new DomainError('name and a withdrawal period of 0 or more days are required');
    return this.treatments.saveProduct({ name, withdrawalDays });
  }

  listProducts(): TreatmentProduct[] {
    return [...this.treatments.products().values()];
  }

  recordTreatment(memberId: string, hiveId: string, product: string, startDate: string, endDate: string): Treatment {
    this.ownedHive(memberId, hiveId);
    if (!this.treatments.products().has(product)) throw new DomainError(`unknown product ${product}`);
    if (endDate < startDate) throw new DomainError('endDate is before startDate');
    return this.treatments.save({ id: randomUUID(), hiveId, product, startDate, endDate });
  }

  recordHarvest(memberId: string, hiveId: string, date: string, kg: number): Harvest {
    this.ownedHive(memberId, hiveId);
    if (!(kg > 0)) throw new DomainError('kg must be positive');
    const blocking = harvestBlockedBy(date, this.treatments.forHive(hiveId), this.treatments.products());
    if (blocking) {
      const from = harvestAllowedFrom(blocking, this.treatments.products().get(blocking.product));
      throw new DomainError(`harvest not allowed: treatment with ${blocking.product}; allowed again from ${from}`, 409);
    }
    return this.harvests.save({ id: randomUUID(), hiveId, date, kg });
  }

  treatmentsOf(hiveId: string): Treatment[] {
    return this.treatments.forHive(hiveId);
  }

  harvestsOf(hiveId: string): Harvest[] {
    return this.harvests.forHive(hiveId);
  }

  private ownedHive(memberId: string, hiveId: string): Hive {
    const hive = this.hives.hive(hiveId);
    if (!hive) throw new DomainError('hive not found', 404);
    if (hive.ownerId !== memberId) throw new DomainError('only the hive owner can do this', 403);
    return hive;
  }
}
