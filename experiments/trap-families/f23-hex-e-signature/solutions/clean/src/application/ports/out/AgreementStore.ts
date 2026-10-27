import type { Agreement } from '../../../domain/model/Agreement';

export interface AgreementStore {
  nextId(): string;
  get(id: string): Promise<Agreement | undefined>;
  save(agreement: Agreement): Promise<void>;
  /** Every agreement, in the order they were drafted. */
  all(): Promise<Agreement[]>;
  /** The agreement whose current signing has this reference. */
  findBySigning(signingRef: string): Promise<Agreement | undefined>;
}
