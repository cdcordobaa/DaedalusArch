/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { Claim } from '../domain/claim/Claim';
import { ClaimRepository } from '../domain/claim/ClaimRepository';

export class InMemoryClaimRepository implements ClaimRepository {
  private readonly claims = new Map<string, Claim>();

  async byId(id: string): Promise<Claim | undefined> {
    return this.claims.get(id);
  }

  async save(claim: Claim): Promise<void> {
    this.claims.set(claim.id, claim);
  }
}
