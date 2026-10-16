import { randomUUID } from 'node:crypto';
import { UNSORTED, donationKey } from '../domain/donation';
import { InventoryItem } from '../domain/inventory';
import { CategoryMappingRepository, DonationFeed, ImportLog, InventoryRepository } from './ports';

export interface ImportResult {
  date: string;
  added: number;
  skippedDuplicates: number;
  unsorted: number;
}

export class DonationImportService {
  constructor(
    private readonly feed: DonationFeed,
    private readonly mappings: CategoryMappingRepository,
    private readonly inventory: InventoryRepository,
    private readonly log: ImportLog,
    private readonly now: () => Date = () => new Date(),
  ) {}

  setMapping(productCode: string, category: string): void {
    if (!productCode || !category) throw new Error('productCode and category are required');
    this.mappings.set(productCode, category);
  }

  listMappings(): Record<string, string> {
    return this.mappings.all();
  }

  async importYesterday(): Promise<ImportResult> {
    const yesterday = new Date(this.now().getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const products = await this.feed.donatedOn(yesterday);
    const result: ImportResult = { date: yesterday, added: 0, skippedDuplicates: 0, unsorted: 0 };
    for (const p of products) {
      const key = donationKey(yesterday, p);
      if (this.log.has(key)) {
        result.skippedDuplicates++;
        continue;
      }
      this.log.add(key);
      const category = this.mappings.categoryFor(p.productCode) ?? UNSORTED;
      if (category === UNSORTED) result.unsorted++;
      const item: InventoryItem = { id: randomUUID(), name: p.name, category, quantity: p.quantity, bestBefore: p.bestBefore };
      this.inventory.save(item);
      result.added++;
    }
    return result;
  }
}
