import type { ListAvailablePets } from '../../../application/ports/in/ListAvailablePets';
import { AdoptionStatsService } from '../../../application/services/AdoptionStatsService';
import { daysBetween } from '../../../domain/model/Calendar';
import type { AdoptionApplication } from '../../../domain/model/AdoptionApplication';

/** What the screen reads; any object with these members will do. */
interface Rows<T> { all(): T[] }
interface Named { byId(id: string): { name: string } | undefined }
import { type HttpResponse, respond } from './HttpResponse';

/** The front desk screen: GET /front-desk/available-pets. */
export class FrontDeskController {
  constructor(
    private readonly listAvailable: ListAvailablePets,
    private readonly applications: Rows<AdoptionApplication>,
    private readonly pets: Named,
    private readonly adopters: Named,
    private readonly today: () => string,
    private readonly stats: AdoptionStatsService,
  ) {}

  availablePets(): HttpResponse {
    return respond(() => this.listAvailable.availablePets());
  }

  waitingList(): HttpResponse {
    const today = this.today();
    return respond(() => this.applications.all()
      .filter((a) => a.isPending())
      .map((a) => ({ application: a.id, pet: this.pets.byId(a.petId)?.name, adopter: this.adopters.byId(a.adopterId)?.name, waitingDays: daysBetween(a.submittedOn, today) }))
      .sort((x, y) => y.waitingDays - x.waitingDays || (x.application < y.application ? -1 : 1)));
  }

  adoptionsBySpecies(month: string): HttpResponse {
    return respond(() => this.stats.bySpecies(month));
  }
}
