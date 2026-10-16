import { DonationReceiptRepository, HouseholdRepository, InventoryRepository, PickupRepository } from './ports';

export interface CategoryRow {
  category: string;
  received: number;
  handedOut: number;
  thrownAway: number;
}

export interface WeeklyReport {
  from: string;
  to: string;
  categories: CategoryRow[];
  householdsByPostcode: { postcode: string; households: number }[];
}

export class NetworkReportService {
  constructor(
    private readonly receipts: DonationReceiptRepository,
    private readonly pickups: PickupRepository,
    private readonly inventory: InventoryRepository,
    private readonly households: HouseholdRepository,
  ) {}

  /** Report for the 7 days from `from` (YYYY-MM-DD, inclusive). */
  weekly(from: string): WeeklyReport {
    const to = new Date(new Date(`${from}T00:00:00Z`).getTime() + 6 * 86400000).toISOString().slice(0, 10);
    const rows = new Map<string, CategoryRow>();
    const row = (category: string): CategoryRow => {
      let r = rows.get(category);
      if (!r) {
        r = { category, received: 0, handedOut: 0, thrownAway: 0 };
        rows.set(category, r);
      }
      return r;
    };
    for (const d of this.receipts.between(from, to)) row(d.category).received += d.quantity;

    const served = new Map<string, Set<string>>();
    const postcodeOf = new Map(this.households.list().map((h) => [h.id, h.postcode]));
    for (const p of this.pickups.list()) {
      if (p.date < from || p.date > to) continue;
      for (const l of p.lines) row(l.category).handedOut += l.quantity;
      const pc = postcodeOf.get(p.householdId) ?? 'unknown';
      if (!served.has(pc)) served.set(pc, new Set());
      served.get(pc)?.add(p.householdId);
    }
    // stock whose best-before date fell in the week and was not handed out is thrown away
    for (const item of this.inventory.list()) {
      if (item.quantity > 0 && item.bestBefore >= from && item.bestBefore < to) row(item.category).thrownAway += item.quantity;
    }
    return {
      from,
      to,
      categories: [...rows.values()].sort((a, b) => a.category.localeCompare(b.category)),
      householdsByPostcode: [...served.entries()].map(([postcode, s]) => ({ postcode, households: s.size })).sort((a, b) => a.postcode.localeCompare(b.postcode)),
    };
  }
}
