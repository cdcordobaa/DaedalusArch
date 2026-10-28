import { CanteenError } from '../../domain/errors/CanteenError';
import { plainPence, type Pence } from '../../domain/model/Pence';
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

  export(date: unknown): FinanceExportResult {
    const day = requireDate(date);
    const byClass = new Map<string, { meals: number; amount: Pence }>();
    for (const o of this.orders.onDate(day)) {
      if (o.status === 'cancelled') continue;
      const pupil = this.pupils.byId(o.pupilId);
      if (pupil === null) throw new CanteenError(`no pupil ${o.pupilId}`);
      let line = byClass.get(pupil.className);
      if (line === undefined) {
        line = { meals: 0, amount: 0 };
        byClass.set(pupil.className, line);
      }
      line.meals += 1;
      line.amount += o.price;
    }
    const names = [...byClass.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    let meals = 0;
    let amount: Pence = 0;
    let text = 'class,meals,amount\n';
    for (const name of names) {
      const line = byClass.get(name)!;
      meals += line.meals;
      amount += line.amount;
      text += `${name},${line.meals},${plainPence(line.amount)}\n`;
    }
    text += `total,${meals},${plainPence(amount)}\n`;
    const file = `takings-${day}.csv`;
    this.folder.write(file, text);
    return { file, classes: names.length };
  }
}
