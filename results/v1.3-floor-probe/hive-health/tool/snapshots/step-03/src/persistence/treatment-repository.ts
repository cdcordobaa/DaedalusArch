import { Harvest, Treatment, TreatmentProduct } from './model';
import { InMemoryDb } from './db';

export class TreatmentRepository {
  constructor(private readonly db: InMemoryDb) {}

  saveProduct(p: TreatmentProduct): TreatmentProduct {
    this.db.products.set(p.name, p);
    return p;
  }
  products(): Map<string, TreatmentProduct> {
    return this.db.products;
  }
  save(t: Treatment): Treatment {
    this.db.treatments.set(t.id, t);
    return t;
  }
  forHive(hiveId: string): Treatment[] {
    return [...this.db.treatments.values()].filter((t) => t.hiveId === hiveId);
  }
  all(): Treatment[] {
    return [...this.db.treatments.values()];
  }
}

export class HarvestRepository {
  constructor(private readonly db: InMemoryDb) {}

  save(h: Harvest): Harvest {
    this.db.harvests.set(h.id, h);
    return h;
  }
  forHive(hiveId: string): Harvest[] {
    return [...this.db.harvests.values()].filter((h) => h.hiveId === hiveId);
  }
  all(): Harvest[] {
    return [...this.db.harvests.values()];
  }
}
