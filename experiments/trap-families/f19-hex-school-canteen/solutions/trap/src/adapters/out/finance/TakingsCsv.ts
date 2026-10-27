import { plainPence } from '../../../domain/model/Pence';
import { requireDate } from '../../../domain/model/SchoolDate';
import type { CanteenDatabase } from '../memory/CanteenDatabase';
import type { FinanceFolder } from './FinanceFolder';

/** Writes a day's takings per class into the finance folder. */
export class TakingsCsv {
  constructor(private readonly db: CanteenDatabase, private readonly folder: FinanceFolder) {}

  write(date: unknown): { file: string; classes: number } {
    const day = requireDate(date);
    const rows = new Map<string, { meals: number; pence: number }>();
    for (const o of this.db.orders.values()) {
      if (o.servingDate !== day || !o.isServed()) continue;
      const c = this.db.pupils.get(o.pupilId)?.className ?? '?';
      const r = rows.get(c) ?? { meals: 0, pence: 0 };
      r.meals += 1;
      r.pence += o.price;
      rows.set(c, r);
    }
    const classes = [...rows.keys()].sort();
    const total = { meals: 0, pence: 0 };
    let text = 'class,meals,amount\n';
    for (const c of classes) {
      const r = rows.get(c)!;
      total.meals += r.meals;
      total.pence += r.pence;
      text += `${c},${String(r.meals)},${plainPence(r.pence)}\n`;
    }
    text += `total,${String(total.meals)},${plainPence(total.pence)}\n`;
    const file = `takings-${day}.csv`;
    this.folder.put(file, text);
    return { file, classes: classes.length };
  }
}
