import type { Hire } from '../../domain/model/Hire';
import { HireError } from '../../domain/errors/HireError';
import { HirePricing } from '../../domain/services/HirePricing';
import { HireNights } from '../../domain/services/HireNights';
import type { HireBoats, HireRequest, HireView } from '../ports/in/HireBoats';
import type { CoverQuotes } from '../ports/out/CoverQuotes';
import type { CoverPolicies } from '../ports/out/CoverPolicies';
import type { Hires } from '../ports/out/Hires';

export class HireService implements HireBoats {
  constructor(
    private readonly hires: Hires,
    private readonly quotes: CoverQuotes,
    private readonly policies: CoverPolicies,
    private readonly pricing: HirePricing = new HirePricing(),
  ) {}

  async reserve(r: HireRequest): Promise<HireView> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.from)) throw new HireError('a hire starts on a day written YYYY-MM-DD');
    const quote = await this.quotes.find(r.quoteRef);
    if (quote.cover === 'in_review') return { hireId: r.hireId, status: 'cover_in_review' };
    if (quote.cover !== 'bound') return { hireId: r.hireId, status: 'no_cover', reason: 'This hire has no cover yet.' };
    const price =this.pricing.price(r.nights, quote.premium);
    const hire: Hire = { hireId: r.hireId, boatId: r.boatId, from: r.from, nights: r.nights, hirerRef: r.hirerRef, quoteRef: r.quoteRef, price, state: 'reserved' };
    if (!(await this.hires.saveUnlessConflict(hire, (other) => HireNights.overlap(other, hire)))) throw new HireError('That boat is already booked for those nights.');
    return this.view(hire);
  }

  async handOver(hireId: string): Promise<HireView> {
    const h = await this.get(hireId);
    if (h.state !== 'reserved') throw new HireError('only a reserved hire can be handed over');
    const policy = await this.policies.forQuote(h.quoteRef);
    if (policy.outstandingPaperwork.length > 0) return { hireId: h.hireId, status: 'documents_missing', missing: [...policy.outstandingPaperwork] };
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
