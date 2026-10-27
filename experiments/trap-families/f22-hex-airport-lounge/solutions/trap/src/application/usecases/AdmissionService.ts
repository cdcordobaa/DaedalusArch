import { localClock } from '../../adapters/out/zones/AirportZones';
import { NotFound } from '../../domain/errors/LoungeErrors';
import type { Lounge } from '../../domain/model/Lounge';
import type { Pass } from '../../domain/model/Pass';
import type { PartnerRule } from '../../domain/model/PartnerRule';
import { Visit } from '../../domain/model/Visit';
import { checkEntry, checkGuests, checkRoom } from '../../domain/rules/Admission';
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
    const pass = this.pass(passId);
    const lounge = this.lounge(loungeId);
    const now = this.clock.now();
    checkEntry({
      lounge,
      pass,
      partner: this.partnerOf(pass),
      guests,
      inside: this.visits.inProgressAt(lounge.id),
      passInside: this.visits.inProgressFor(pass.id) !== null,
      today: this.calendar.dateAt(lounge.airport, now),
      localHour: localClock(lounge.airport, now).hour,
      now,
    });
    const visit = new Visit(this.visits.nextId(), pass.id, lounge.id, guests, now);
    this.visits.save(visit);
    return { visit: visit.id, lounge: lounge.id, guests: visit.guests, enteredAt: visit.enteredAt };
  }

  addGuest(visitId: string): { visit: string; guests: number } {
    const visit = this.visits.get(visitId);
    if (visit === null) throw new NotFound(`no visit ${visitId}`);
    visit.ensureInProgress();
    const pass = this.pass(visit.passId);
    const lounge = this.lounge(visit.loungeId);
    const now = this.clock.now();
    checkGuests(lounge, pass, this.partnerOf(pass), visit.guests + 1, localClock(lounge.airport, now).hour);
    checkRoom(lounge, this.visits.inProgressAt(lounge.id), 1, now);
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
    const lounge = this.lounge(loungeId);
    const people = this.visits.inProgressAt(lounge.id).reduce((sum, v) => sum + v.people, 0);
    return { lounge: lounge.id, people, capacity: lounge.capacity };
  }

  private pass(passId: string): Pass {
    const pass = this.passes.get(passId);
    if (pass === null) throw new NotFound(`no pass ${passId}`);
    return pass;
  }

  private lounge(loungeId: string): Lounge {
    const lounge = this.lounges.get(loungeId);
    if (lounge === null) throw new NotFound(`no lounge ${loungeId}`);
    return lounge;
  }

  private partnerOf(pass: Pass): PartnerRule | null {
    return pass.kind === 'airline' ? this.partners.get(pass.airline) : null;
  }
}
