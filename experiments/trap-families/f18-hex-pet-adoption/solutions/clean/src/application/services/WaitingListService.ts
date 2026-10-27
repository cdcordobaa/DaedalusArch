import { daysBetween } from '../../domain/model/Calendar';
import type { WaitingEntry, WaitingList } from '../ports/in/WaitingList';
import type { AdopterStore } from '../ports/out/AdopterStore';
import type { ApplicationStore } from '../ports/out/ApplicationStore';
import type { Clock } from '../ports/out/Clock';
import type { PetStore } from '../ports/out/PetStore';

export class WaitingListService implements WaitingList {
  constructor(
    private readonly applications: ApplicationStore,
    private readonly pets: PetStore,
    private readonly adopters: AdopterStore,
    private readonly clock: Clock,
  ) {}

  waitingList(): WaitingEntry[] {
    const today = this.clock.today();
    return this.applications
      .pending()
      .map((a) => ({
        application: a.id,
        pet: this.pets.byId(a.petId)?.name ?? a.petId,
        adopter: this.adopters.byId(a.adopterId)?.name ?? a.adopterId,
        waitingDays: daysBetween(a.submittedOn, today),
      }))
      .sort((x, y) => y.waitingDays - x.waitingDays || (x.application < y.application ? -1 : 1));
  }
}
