import { Claim } from "../domain/claim/Claim";
import { ClaimRepository } from "../domain/claim/ClaimRepository";

export class InMemoryClaimRepository implements ClaimRepository {
  private readonly claims = new Map<string, Claim>();

  save(claim: Claim): void {
    this.claims.set(claim.id, claim);
  }

  saveBoth(first: Claim, second: Claim): void {
    this.claims.set(first.id, first);
    this.claims.set(second.id, second);
  }

  byId(id: string): Claim | undefined {
    return this.claims.get(id);
  }

  count(): number {
    return this.claims.size;
  }
}
