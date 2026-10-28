import type { ListAvailablePets } from '../../../application/ports/in/ListAvailablePets';
import { type HttpResponse, respond } from './HttpResponse';

/** The front desk screen: GET /front-desk/available-pets. */
export class FrontDeskController {
  constructor(private readonly listAvailable: ListAvailablePets) {}

  availablePets(): HttpResponse {
    return respond(() => this.listAvailable.availablePets());
  }
}
