import { InvalidOperation } from './errors';

export interface Household { adults: number; children: number; otherPets: string[]; housing: string; garden: boolean }
export interface Contact { name: string; email: string; phone?: string; address?: string }

export type Decision = 'pending' | 'approved' | 'rejected';

export class AdoptionApplication {
  public decision: Decision = 'pending';
  public decidedAt?: string;

  constructor(readonly id: string, readonly animalId: string, readonly applicant: Contact, readonly household: Household, readonly submittedAt: string) {}

  approve(at: string): void { this.decide('approved', at); }
  reject(at: string): void { this.decide('rejected', at); }
  get isOpen(): boolean { return this.decision === 'pending'; }

  private decide(d: Decision, at: string): void {
    if (!this.isOpen) throw new InvalidOperation(`application already ${this.decision}`);
    this.decision = d;
    this.decidedAt = at;
  }
}
