import { NotFound } from '../../domain/errors/LoungeErrors';
import { Visit } from '../../domain/model/Visit';
import { checkEntry } from '../../domain/rules/Admission';
import type { Admissions, OccupancyView, VisitView } from '../ports/in/Admissions';
import type { Clock } from '../ports/out/Clock';
import type { LocalCalendar } from '../ports/out/LocalCalendar';
import type { LoungeStore } from '../ports/out/LoungeStore';
import type { PartnerStore } from '../ports/out/PartnerStore';
import type { PassStore } from '../ports/out/PassStore';
import type { VisitStore } from '../ports/out/VisitStore';

export class AdmissionService implements Admissions {
  constructor(
    private readonly lounges: LoungeStore,
    private readonly passes: PassStore,
    private readonly partners: PartnerStore,
    private readonly visits: VisitStore,
    private readonly clock: Clock,
    private readonly calendar: LocalCalendar,
  ) {}

  enter(passId: string, loungeId: string, guests: number): VisitView {
    const pass = this.passes.get(passId);
    if (pass === null) throw new NotFound(`no pass ${passId}`);
    const lounge = this.lounges.get(loungeId);
    if (lounge === null) throw new NotFound(`no lounge ${loungeId}`);
    const now = this.clock.now();
    checkEntry({
      lounge,
      pass,
      partner: pass.kind === 'airline' ? this.partners.get(pass.airline) : null,
      guests,
      peopleInside: this.peopleIn(lounge.id),
      passInside: this.visits.inProgressFor(pass.id) !== null,
      hour: this.calendar.hourAt(lounge.airport, now),
      today: this.calendar.dateAt(lounge.airport, now),
    });
    const visit = new Visit(this.visits.nextId(), pass.id, lounge.id, guests, now);
    this.visits.save(visit);
    return { visit: visit.id, lounge: lounge.id, guests: visit.guests, enteredAt: visit.enteredAt };
  }

  leave(visitId: string): { visit: string; leftAt: string } {
    const visit = this.visits.get(visitId);
    if (visit === null) throw new NotFound(`no visit ${visitId}`);
    visit.leave(this.clock.now());
    this.visits.save(visit);
    return { visit: visit.id, leftAt: visit.leftAt ?? '' };
  }

  occupancy(loungeId: string): OccupancyView {
    const lounge = this.lounges.get(loungeId);
    if (lounge === null) throw new NotFound(`no lounge ${loungeId}`);
    return { lounge: lounge.id, people: this.peopleIn(lounge.id), capacity: lounge.capacity };
  }

  private peopleIn(loungeId: string): number {
    return this.visits.inProgressAt(loungeId).reduce((sum, v) => sum + v.people, 0);
  }
}
