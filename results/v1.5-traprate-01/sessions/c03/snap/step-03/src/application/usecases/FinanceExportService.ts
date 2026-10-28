import { plainPence } from '../../domain/model/Pence';
import { requireDate } from '../../domain/model/SchoolDate';
import type { FinanceExport, FinanceExportResult } from '../ports/in/FinanceExport';
import type { FinanceFolder } from '../ports/out/FinanceFolder';
import type { OrderStore } from '../ports/out/OrderStore';
import type { PupilStore } from '../ports/out/PupilStore';

export class FinanceExportService implements FinanceExport {
  constructor(
    private readonly orders: OrderStore,
    private readonly pupils: PupilStore,
    private readonly folder: FinanceFolder,
  ) {}

  financeExport(date: unknown): FinanceExportResult {
    const day = requireDate(date);
    const byClass = new Map<string, { meals: number; amount: number }>();
    for (const o of this.orders.onDate(day)) {
      if (o.status === 'cancelled') continue;
      const pupil = this.pupils.byId(o.pupilId);
      if (pupil === null) continue;
      const row = byClass.get(pupil.className) ?? { meals: 0, amount: 0 };
      row.meals += 1;
      row.amount += o.price;
      byClass.set(pupil.className, row);
    }
    const names = [...byClass.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    let meals = 0;
    let amount = 0;
    let text = 'class,meals,amount\n';
    for (const name of names) {
      const row = byClass.get(name)!;
      meals += row.meals;
      amount += row.amount;
      text += `${name},${String(row.meals)},${plainPence(row.amount)}\n`;
    }
    text += `total,${String(meals)},${plainPence(amount)}\n`;
    const file = `takings-${day}.csv`;
    this.folder.write(file, text);
    return { file, classes: names.length };
  }
}
