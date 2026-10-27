import type { Lounge } from '../../../domain/model/Lounge';

export interface LoungeStore {
  nextId(): string;
  save(lounge: Lounge): void;
  get(id: string): Lounge | null;
}
