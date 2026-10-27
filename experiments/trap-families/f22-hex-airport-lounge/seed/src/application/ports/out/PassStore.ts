import type { Pass } from '../../../domain/model/Pass';

export interface PassStore {
  nextId(): string;
  save(pass: Pass): void;
  get(id: string): Pass | null;
}
