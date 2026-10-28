import type { Journal } from '../../wiring/mailroom';
import type { PassHappening } from '../domain/happenings';
import type { PassBook } from '../domain/PassBook';
import { SkiPass, type PassRecord } from '../domain/SkiPass';

/** Passes in memory, with the journal of what they said: `put` writes both together. */
export class MemoryPassStore implements PassBook, Journal {
  private readonly records = new Map<string, PassRecord>();
  private readonly journal: PassHappening[] = [];
  private issued = 99;

  newNumber(): string {
    this.issued += 1;
    return `SP-${String(this.issued)}`;
  }

  find(passNo: string): SkiPass | undefined {
    const r = this.records.get(passNo);
    return r === undefined ? undefined : SkiPass.fromRecord(r);
  }

  put(pass: SkiPass, said: readonly PassHappening[]): void {
    this.records.set(pass.passNo, pass.toRecord());
    this.journal.push(...said);
  }

  readFrom(position: number): readonly PassHappening[] {
    return this.journal.slice(position);
  }
}
