import type { AdoptionsBySpecies } from '../../../application/ports/in/AdoptionsBySpecies';
import type { ListAvailablePets } from '../../../application/ports/in/ListAvailablePets';
import type { ListWaitingApplications } from '../../../application/ports/in/ListWaitingApplications';
import { type HttpResponse, respond } from './HttpResponse';

/** The front desk screen: GET /front-desk/available-pets and GET /front-desk/waiting-list. */
export class FrontDeskController {
  constructor(
    private readonly listAvailable: ListAvailablePets,
    private readonly listWaiting: ListWaitingApplications,
    private readonly bySpecies: AdoptionsBySpecies,
  ) {}

  adoptionsBySpecies(month: string): HttpResponse {
    return respond(() => this.bySpecies.adoptionsBySpecies(month));
  }

  availablePets(): HttpResponse {
    return respond(() => this.listAvailable.availablePets());
  }

  waitingList(): HttpResponse {
    return respond(() => this.listWaiting.waitingList());
  }
}
