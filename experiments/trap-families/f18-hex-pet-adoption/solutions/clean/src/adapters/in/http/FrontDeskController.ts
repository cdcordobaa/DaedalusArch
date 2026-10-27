import type { AdoptionsBySpecies } from '../../../application/ports/in/AdoptionsBySpecies';
import type { ListAvailablePets } from '../../../application/ports/in/ListAvailablePets';
import type { WaitingList } from '../../../application/ports/in/WaitingList';
import { type HttpResponse, respond } from './HttpResponse';

/** The front desk screen: GET /front-desk/available-pets, /front-desk/waiting-list and
 * /front-desk/adoptions-by-species?month=. */
export class FrontDeskController {
  constructor(
    private readonly listAvailable: ListAvailablePets,
    private readonly waiting: WaitingList,
    private readonly bySpecies: AdoptionsBySpecies,
  ) {}

  availablePets(): HttpResponse {
    return respond(() => this.listAvailable.availablePets());
  }

  waitingList(): HttpResponse {
    return respond(() => this.waiting.waitingList());
  }

  adoptionsBySpecies(month: string): HttpResponse {
    return respond(() => this.bySpecies.adoptionsBySpecies(month));
  }
}
