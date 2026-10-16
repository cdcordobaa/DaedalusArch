import type { Money } from '../../../shared-kernel/value-objects/Money.js';
import type { InvoiceLine } from './InvoiceLine.js';

export function taxLines(lines: readonly InvoiceLine[]): readonly InvoiceLine[] {
  return lines.filter((l) => l.description === 'tax');
}

export function sumOf(lines: readonly InvoiceLine[], zero: Money): Money {
  return lines.reduce((s, l) => s.add(l.amount), zero);
}
