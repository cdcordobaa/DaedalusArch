import type { Lounge } from '../../../domain/model/Lounge';
import type { PartnerRule } from '../../../domain/model/PartnerRule';
import type { Pass } from '../../../domain/model/Pass';
import type { Visit } from '../../../domain/model/Visit';

/** The in-memory tables and id counters behind the memory stores. */
export class LoungeData {
  readonly lounges = new Map<string, Lounge>();
  readonly passes = new Map<string, Pass>();
  readonly partners = new Map<string, PartnerRule>();
  readonly visits = new Map<string, Visit>();
  private readonly counters = new Map<string, number>();

  next(prefix: string, width: number): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}-${String(n).padStart(width, '0')}`;
  }
}
