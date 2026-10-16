import { Apiary, Harvest, Hive, Inspection, Member, ScaleReading, SwarmAlert, Treatment, TreatmentProduct } from '../business/model';

/** The in-memory database. */
export class InMemoryDb {
  readonly members = new Map<string, Member>();
  readonly apiaries = new Map<string, Apiary>();
  readonly hives = new Map<string, Hive>();
  readonly inspections = new Map<string, Inspection>();
  readonly scaleLinks = new Map<string, string>(); // serial -> hiveId
  readonly readings: ScaleReading[] = [];
  readonly swarmAlerts: SwarmAlert[] = [];
  readonly products = new Map<string, TreatmentProduct>();
  readonly treatments = new Map<string, Treatment>();
  readonly harvests = new Map<string, Harvest>();
}
