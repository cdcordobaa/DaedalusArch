import { Apiary, Hive, Inspection, Member } from './model';

/** The in-memory database. */
export class InMemoryDb {
  readonly members = new Map<string, Member>();
  readonly apiaries = new Map<string, Apiary>();
  readonly hives = new Map<string, Hive>();
  readonly inspections = new Map<string, Inspection>();
}
