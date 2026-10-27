import type { Visit } from '../../../domain/model/Visit';

export interface VisitStore {
  nextId(): string;
  save(visit: Visit): void;
  get(id: string): Visit | null;
  /** Visits in progress in one lounge, earliest entry first. */
  inProgressAt(loungeId: string): Visit[];
  /** The visit in progress of one pass, in any lounge. */
  inProgressFor(passId: string): Visit | null;
}
