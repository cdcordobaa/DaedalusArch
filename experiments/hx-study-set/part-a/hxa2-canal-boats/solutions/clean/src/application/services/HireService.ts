import type { Hire } from '../../domain/model/Hire';
import { HireError } from '../../domain/errors/HireError';
import { HirePricing } from '../../domain/services/HirePricing';
import type { HireBoats, HireRequest, HireView } from '../ports/in/HireBoats';
import type { CoverQuotes } from '../ports/out/CoverQuotes';
import type { Hires } from '../ports/out/Hires';
import type { Policies } from '../ports/out/Policies';

export class HireService implements HireBoats {
  constructor(
    private readonly hires: Hires,
    private readonly quotes: CoverQuotes,
    private readonly policies: Policies,
    private readonly pricing: HirePricing = new HirePricing(),
  ) {}

  async reserve(r: HireRequest): Promise<HireView> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.from)) throw new HireError('a hire starts on a day written YYYY-MM-DD');
    const quote = await this.quotes.find(r.quoteRef);
    if (quote.standing === 'in_review') return { hireId: r.hireId, status: 'cover_in_review' };
    if (quote.standing !== 'covered') return { hireId: r.hireId, status: 'no_cover', reason: 'This hire has no cover yet.' };
    const theirs = await this.hires.forBoat(r.boatId);
    const first = dayNumber(r.from);
    if (theirs.some((h) => h.state !== 'returned' && dayNumber(h.from) < first + r.nights && first < dayNumber(h.from) + h.nights)) throw new HireError('That boat is already booked for those nights.');
    const price = this.pricing.price(r.nights, quote.premium);
    const hire: Hire = { hireId: r.hireId, boatId: r.boatId, from: r.from, nights: r.nights, hirerRef: r.hirerRef, quoteRef: r.quoteRef, price, state: 'reserved' };
    await this.hires.save(hire);
    return this.view(hire);
  }

  async handOver(hireId: string): Promise<HireView> {
    const h = await this.get(hireId);
    if (h.state !== 'reserved') throw new HireError('only a reserved hire can be handed over');
    const policy = await this.policies.forQuote(h.quoteRef);
    if (!policy.ready) return { hireId: h.hireId, status: 'documents_missing', missing: policy.missing };
    const next: Hire = { ...h, state: 'on_water', policyNo: policy.policyNo };
    await this.hires.save(next);
    return { ...this.view(next), policyNo: policy.policyNo };
  }

  async bringBack(hireId: string): Promise<HireView> {
    const h = await this.get(hireId);
    if (h.state !== 'on_water') throw new HireError('the boat is not out');
    const next: Hire = { ...h, state: 'returned' };
    await this.hires.save(next);
    return this.view(next);
  }

  private async get(hireId: string): Promise<Hire> {
    const h = await this.hires.get(hireId);
    if (h === null) throw new HireError('there is no hire ' + hireId);
    return h;
  }

  private view(h: Hire): HireView {
    return { hireId: h.hireId, status: h.state, boatId: h.boatId, price: h.price };
  }
}

function dayNumber(day: string): number {
  return Math.round(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86400000);
}
