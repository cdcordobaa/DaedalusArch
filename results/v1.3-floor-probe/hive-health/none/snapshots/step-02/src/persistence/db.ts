import { Apiary, Hive, Inspection, Member, ScaleReading, SwarmAlert } from '../business/model';

/** The in-memory database. */
export class InMemoryDb {
  readonly members = new Map<string, Member>();
  readonly apiaries = new Map<string, Apiary>();
  readonly hives = new Map<string, Hive>();
  readonly inspections = new Map<string, Inspection>();
  readonly scaleLinks = new Map<string, string>(); // serial -> hiveId
  readonly readings: ScaleReading[] = [];
  readonly swarmAlerts: SwarmAlert[] = [];
}
