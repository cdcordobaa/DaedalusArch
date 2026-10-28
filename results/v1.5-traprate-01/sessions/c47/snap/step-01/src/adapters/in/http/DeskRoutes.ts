import type { Admissions } from '../../../application/ports/in/Admissions';
import type { LoungeSetup } from '../../../application/ports/in/LoungeSetup';
import type { PassSales } from '../../../application/ports/in/PassSales';
import { reply, type Reply } from './reply';

/** The front-desk HTTP routes, one method per route; each answers { status, body }. */
export class DeskRoutes {
  constructor(private readonly setup: LoungeSetup, private readonly sales: PassSales, private readonly admissions: Admissions) {}

  /** POST /lounges */
  openLounge(body: { name: string; airport: string; capacity: number; partners: string[] }): Reply {
    return reply(() => ({ id: this.setup.openLounge(body.name, body.airport, body.capacity, body.partners) }));
  }

  /** PUT /partners/:airline */
  addPartner(body: { airline: string; guests: number; guestCutoff?: number }): Reply {
    return reply(() => {
      this.setup.addPartner(body.airline, body.guests, body.guestCutoff);
      return { airline: body.airline.trim().toUpperCase() };
    });
  }

  /** POST /passes/airline */
  registerAirlinePass(body: { holder: string; airline: string }): Reply {
    return reply(() => ({ id: this.sales.registerAirlinePass(body.holder, body.airline) }));
  }

  /** POST /passes/day */
  sellDayPass(body: { holder: string; airport: string; date: string }): Reply {
    return reply(() => ({ id: this.sales.sellDayPass(body.holder, body.airport, body.date) }));
  }

  /** POST /visits */
  enter(body: { pass: string; lounge: string; guests?: number }): Reply {
    return reply(() => this.admissions.enter(body.pass, body.lounge, body.guests ?? 0));
  }

  /** POST /visits/:id/leave */
  leave(visitId: string): Reply {
    return reply(() => this.admissions.leave(visitId));
  }

  /** GET /lounges/:id/occupancy */
  occupancy(loungeId: string): Reply {
    return reply(() => this.admissions.occupancy(loungeId));
  }
}
