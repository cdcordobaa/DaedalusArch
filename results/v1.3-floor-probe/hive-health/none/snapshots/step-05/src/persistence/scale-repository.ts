import { ScaleReading, SwarmAlert } from '../business/model';
import { InMemoryDb } from './db';

export class ScaleRepository {
  constructor(private readonly db: InMemoryDb) {}

  link(serial: string, hiveId: string): void {
    this.db.scaleLinks.set(serial, hiveId);
  }
  hiveFor(serial: string): string | undefined {
    return this.db.scaleLinks.get(serial);
  }
  addReading(r: ScaleReading): void {
    this.db.readings.push(r);
  }
  readingsForHive(hiveId: string): ScaleReading[] {
    return this.db.readings.filter((r) => r.hiveId === hiveId);
  }
  addAlert(a: SwarmAlert): void {
    this.db.swarmAlerts.push(a);
  }
  alertsForHive(hiveId: string): SwarmAlert[] {
    return this.db.swarmAlerts.filter((a) => a.hiveId === hiveId);
  }
}
