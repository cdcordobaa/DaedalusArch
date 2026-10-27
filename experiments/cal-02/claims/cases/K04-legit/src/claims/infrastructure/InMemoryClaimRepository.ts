import { Claim } from "../domain/claim/Claim";
import { ClaimRepository } from "../domain/claim/ClaimRepository";

export class InMemoryClaimRepository implements ClaimRepository {
  private readonly claims = new Map<string, Claim>();
  private readonly lineRows = new Map<string, { readonly id: string }>();

  save(claim: Claim): void {
    this.claims.set(claim.id, claim);
    for (const line of claim.lineItems()) {
      this.lineRows.set(line.id, line);
    }
  }

  byId(id: string): Claim | undefined {
    return this.claims.get(id);
  }

  count(): number {
    return this.claims.size;
  }
}
