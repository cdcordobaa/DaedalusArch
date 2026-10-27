import { plainPence } from '../../domain/model/Pence';
import { requireDate } from '../../domain/model/SchoolDate';
import type { TakingsExport, TakingsExportResult } from '../ports/in/TakingsExport';
import type { FinanceDrop } from '../ports/out/FinanceDrop';
import type { OrderStore } from '../ports/out/OrderStore';
import type { PupilStore } from '../ports/out/PupilStore';

export class TakingsExportService implements TakingsExport {
  constructor(private readonly orders: OrderStore, private readonly pupils: PupilStore, private readonly drop: FinanceDrop) {}

  exportDay(date: unknown): TakingsExportResult {
    const day = requireDate(date);
    const perClass = new Map<string, { meals: number; pence: number }>();
    for (const order of this.orders.forDate(day).filter((o) => o.isServed())) {
      const className = this.pupils.byId(order.pupilId)?.className ?? '?';
      const row = perClass.get(className) ?? { meals: 0, pence: 0 };
      row.meals += 1;
      row.pence += order.price;
      perClass.set(className, row);
    }
    const classes = [...perClass.keys()].sort();
    let meals = 0;
    let pence = 0;
    const lines = ['class,meals,amount'];
    for (const c of classes) {
      const row = perClass.get(c)!;
      meals += row.meals;
      pence += row.pence;
      lines.push(`${c},${String(row.meals)},${plainPence(row.pence)}`);
    }
    lines.push(`total,${String(meals)},${plainPence(pence)}`);
    const file = `takings-${day}.csv`;
    this.drop.put(file, `${lines.join('\n')}\n`);
    return { file, classes: classes.length };
  }
}
