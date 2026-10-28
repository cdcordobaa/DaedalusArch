import { AccessRefused, NotFound } from '../../domain/errors/LoungeErrors';
import { minutesBetween } from '../../domain/model/Instant';
import { Visit } from '../../domain/model/Visit';
import { checkCutoff, checkEntry, checkGuests, checkRoom } from '../../domain/rules/Admission';
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
      retryAfterMinutes: this.retryAfter(lounge.id),
      hour: this.calendar.hourAt(lounge.airport, now),
      today: this.calendar.dateAt(lounge.airport, now),
    });
    const visit = new Visit(this.visits.nextId(), pass.id, lounge.id, guests, now);
    this.visits.save(visit);
    return { visit: visit.id, lounge: lounge.id, guests: visit.guests, enteredAt: visit.enteredAt };
  }

  addGuest(visitId: string): { visit: string; guests: number } {
    const visit = this.visits.get(visitId);
    if (visit === null) throw new NotFound(`no visit ${visitId}`);
    if (!visit.inProgress) throw new AccessRefused(`visit ${visit.id} has ended`);
    const pass = this.passes.get(visit.passId);
    if (pass === null) throw new NotFound(`no pass ${visit.passId}`);
    const lounge = this.lounges.get(visit.loungeId);
    if (lounge === null) throw new NotFound(`no lounge ${visit.loungeId}`);
    const partner = pass.kind === 'airline' ? this.partners.get(pass.airline) : null;
    const guests = visit.guests + 1;
    checkGuests(lounge, pass, partner, guests);
    if (pass.kind === 'airline') checkCutoff(lounge, partner, guests, this.calendar.hourAt(lounge.airport, this.clock.now()));
    checkRoom(lounge, this.peopleIn(lounge.id), 1, this.retryAfter(lounge.id));
    visit.addGuest();
    this.visits.save(visit);
    return { visit: visit.id, guests: visit.guests };
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

  /** Whole minutes until the earliest visit in progress at the lounge reaches three hours; at least 1. */
  private retryAfter(loungeId: string): number {
    const now = this.clock.now();
    const left = this.visits
      .inProgressAt(loungeId)
      .map((v) => 180 - minutesBetween(v.enteredAt, now));
    return left.length === 0 ? 1 : Math.max(1, Math.ceil(Math.min(...left)));
  }

  private peopleIn(loungeId: string): number {
    return this.visits.inProgressAt(loungeId).reduce((sum, v) => sum + v.people, 0);
  }
}
