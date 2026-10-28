import type { Pontoon } from './Pontoon';

export interface PontoonRepository {
  nextId(): string;
  get(id: string): Pontoon | undefined;
  /** Writes the pontoon and appends its recorded events to the log in one step. */
  put(pontoon: Pontoon): void;
}
