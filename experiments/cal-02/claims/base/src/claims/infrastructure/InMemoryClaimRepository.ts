import { Claim } from "../domain/claim/Claim";
import { ClaimRepository } from "../domain/claim/ClaimRepository";

export class InMemoryClaimRepository implements ClaimRepository {
  private readonly claims = new Map<string, Claim>();

  save(claim: Claim): void {
    this.claims.set(claim.id, claim);
  }

  byId(id: string): Claim | undefined {
    return this.claims.get(id);
  }

  count(): number {
    return this.claims.size;
  }
}
