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
