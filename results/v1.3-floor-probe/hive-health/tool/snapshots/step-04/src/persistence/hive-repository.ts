import { Apiary, Hive, Inspection, Member } from './model';
import { InMemoryDb } from './db';

export class HiveRepository {
  constructor(private readonly db: InMemoryDb) {}

  saveMember(m: Member): Member {
    this.db.members.set(m.id, m);
    return m;
  }
  member(id: string): Member | undefined {
    return this.db.members.get(id);
  }
  saveApiary(a: Apiary): Apiary {
    this.db.apiaries.set(a.id, a);
    return a;
  }
  apiary(id: string): Apiary | undefined {
    return this.db.apiaries.get(id);
  }
  apiariesOf(ownerId: string): Apiary[] {
    return [...this.db.apiaries.values()].filter((a) => a.ownerId === ownerId);
  }
  saveHive(h: Hive): Hive {
    this.db.hives.set(h.id, h);
    return h;
  }
  hive(id: string): Hive | undefined {
    return this.db.hives.get(id);
  }
  hivesIn(apiaryId: string): Hive[] {
    return [...this.db.hives.values()].filter((h) => h.apiaryId === apiaryId);
  }
  allHives(): Hive[] {
    return [...this.db.hives.values()];
  }
  allApiaries(): Apiary[] {
    return [...this.db.apiaries.values()];
  }
}

export class InspectionRepository {
  constructor(private readonly db: InMemoryDb) {}

  save(i: Inspection): Inspection {
    this.db.inspections.set(i.id, i);
    return i;
  }
  forHive(hiveId: string): Inspection[] {
    return [...this.db.inspections.values()].filter((i) => i.hiveId === hiveId).sort((a, b) => a.date.localeCompare(b.date));
  }
  latestForHive(hiveId: string): Inspection | undefined {
    const all = this.forHive(hiveId);
    return all[all.length - 1];
  }
}
