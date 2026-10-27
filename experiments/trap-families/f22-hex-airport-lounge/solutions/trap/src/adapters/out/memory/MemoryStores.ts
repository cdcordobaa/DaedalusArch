import type { LoungeStore } from '../../../application/ports/out/LoungeStore';
import type { PartnerStore } from '../../../application/ports/out/PartnerStore';
import type { PassStore } from '../../../application/ports/out/PassStore';
import type { VisitStore } from '../../../application/ports/out/VisitStore';
import type { Lounge } from '../../../domain/model/Lounge';
import type { PartnerRule } from '../../../domain/model/PartnerRule';
import type { Pass } from '../../../domain/model/Pass';
import type { Visit } from '../../../domain/model/Visit';
import type { LoungeData } from './LoungeData';

export class MemoryLoungeStore implements LoungeStore {
  constructor(private readonly data: LoungeData) {}
  nextId(): string { return this.data.next('L', 2); }
  save(lounge: Lounge): void { this.data.lounges.set(lounge.id, lounge); }
  get(id: string): Lounge | null { return this.data.lounges.get(id) ?? null; }
}

export class MemoryPassStore implements PassStore {
  constructor(private readonly data: LoungeData) {}
  nextId(): string { return this.data.next('P', 4); }
  save(pass: Pass): void { this.data.passes.set(pass.id, pass); }
  get(id: string): Pass | null { return this.data.passes.get(id) ?? null; }
}

export class MemoryPartnerStore implements PartnerStore {
  constructor(private readonly data: LoungeData) {}
  save(rule: PartnerRule): void { this.data.partners.set(rule.airline, rule); }
  get(airline: string): PartnerRule | null { return this.data.partners.get(airline) ?? null; }
}

export class MemoryVisitStore implements VisitStore {
  constructor(private readonly data: LoungeData) {}
  nextId(): string { return this.data.next('V', 4); }
  save(visit: Visit): void { this.data.visits.set(visit.id, visit); }
  get(id: string): Visit | null { return this.data.visits.get(id) ?? null; }
  inProgressAt(loungeId: string): Visit[] {
    return [...this.data.visits.values()].filter((v) => v.loungeId === loungeId && v.inProgress).sort((a, b) => (a.enteredAt < b.enteredAt ? -1 : a.enteredAt > b.enteredAt ? 1 : 0));
  }
  inProgressFor(passId: string): Visit | null {
    return [...this.data.visits.values()].find((v) => v.passId === passId && v.inProgress) ?? null;
  }
}
