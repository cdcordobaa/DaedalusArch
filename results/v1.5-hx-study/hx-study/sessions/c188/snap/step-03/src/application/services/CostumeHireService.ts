import type { CostumeHire } from '../../domain/model/CostumeHire';
import { CleaningBusy, FabricNotAccepted } from '../../domain/errors/CleaningRefused';
import { WardrobeError } from '../../domain/errors/WardrobeError';
import { HireTerms } from '../../domain/services/HireTerms';
import type { LendCostumes, LendView, ReturnView } from '../ports/in/LendCostumes';
import type { Cleaners } from '../ports/out/Cleaners';
import type { CostumeHires } from '../ports/out/CostumeHires';
import type { Wardrobe } from '../ports/out/Wardrobe';

export class CostumeHireService implements LendCostumes {
  private readonly byHand: string[] = [];

  constructor(
    private readonly wardrobe: Wardrobe,
    private readonly hires: CostumeHires,
    private readonly cleaners: Cleaners,
    private readonly terms: HireTerms = new HireTerms(),
  ) {}

  async lend(hireId: string, costumeId: string, from: string, days: number): Promise<LendView> {
    const costume = await this.wardrobe.costume(costumeId);
    if (costume === null) throw new WardrobeError('there is no costume ' + costumeId);
    const hire: CostumeHire = { hireId, costumeId, from: this.terms.day(from), days, price: this.terms.price(days, costume.dayRate), state: 'out' };
    await this.hires.save(hire);
    return { hireId, status: hire.state, costumeId, price: hire.price };
  }

  async takeBack(hireId: string, returnedOn: string): Promise<ReturnView> {
    this.terms.day(returnedOn);
    const hire = await this.hires.get(hireId);
    if (hire === null) throw new WardrobeError('there is no hire ' + hireId);
    if (hire.state !== 'out') throw new WardrobeError('the costume is already back');
    const costume = await this.wardrobe.costume(hire.costumeId);
    if (costume === null) throw new WardrobeError('there is no costume ' + hire.costumeId);
    const lateFee = this.terms.lateFee(hire.from, hire.days, returnedOn);
    let ticket: { ticket: string; readyBy: string };
    try {
      ticket = await this.cleaners.handIn(costume);
    } catch (e) {
      if (e instanceof CleaningBusy) {
        await this.hires.save({ ...hire, state: 'back' });
        return { hireId, status: 'back', lateFee, cleaning: 'later', retryInHours: e.retryInHours };
      }
      if (!(e instanceof FabricNotAccepted)) throw e;
      await this.hires.save({ ...hire, state: 'back' });
      if (!this.byHand.includes(costume.costumeId)) this.byHand.push(costume.costumeId);
      return { hireId, status: 'back', lateFee, cleaning: 'by_hand' };
    }
    await this.hires.save({ ...hire, state: 'back' });
    return { hireId, status: 'back', lateFee, cleaning: 'sent', ticket: ticket.ticket };
  }

  async handCleaning(): Promise<string[]> {
    return [...this.byHand];
  }
}
