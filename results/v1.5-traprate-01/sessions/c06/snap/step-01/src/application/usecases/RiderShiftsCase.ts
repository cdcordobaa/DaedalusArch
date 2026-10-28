import { Rider, type RiderView } from '../../domain/Rider';
import type { RiderShifts } from '../ports/in/Dispatching';
import type { RiderRoster } from '../ports/out/RiderRoster';
import { requireRider } from './lookups';

export class RiderShiftsCase implements RiderShifts {
  constructor(private readonly roster: RiderRoster) {}

  register(request: { name: string; trackerId: string }): RiderView {
    const rider = new Rider(this.roster.nextId(), request.name.trim(), request.trackerId.trim());
    this.roster.save(rider);
    return rider.view();
  }

  clockOff(riderId: string): RiderView {
    const rider = requireRider(this.roster, riderId);
    rider.clockOff();
    this.roster.save(rider);
    return rider.view();
  }
}
