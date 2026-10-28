import { daysBetween } from '../../domain/model/Calendar';
import type { ListWaitingApplications, WaitingApplication } from '../ports/in/ListWaitingApplications';
import type { AdopterStore } from '../ports/out/AdopterStore';
import type { ApplicationStore } from '../ports/out/ApplicationStore';
import type { Clock } from '../ports/out/Clock';
import type { PetStore } from '../ports/out/PetStore';

export class ListWaitingApplicationsService implements ListWaitingApplications {
  constructor(
    private readonly applications: ApplicationStore,
    private readonly pets: PetStore,
    private readonly adopters: AdopterStore,
    private readonly clock: Clock,
  ) {}

  waitingList(): WaitingApplication[] {
    const today = this.clock.today();
    return this.applications
      .pending()
      .map((a) => ({
        application: a.id,
        pet: this.pets.byId(a.petId)?.name ?? a.petId,
        adopter: this.adopters.byId(a.adopterId)?.name ?? a.adopterId,
        waitingDays: daysBetween(a.submittedOn, today),
      }))
      .sort((a, b) => b.waitingDays - a.waitingDays || (a.application < b.application ? -1 : 1));
  }
}
