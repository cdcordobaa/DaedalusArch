import { Claim } from "./Claim";

export interface ClaimRepository {
  save(claim: Claim): void;
  byId(id: string): Claim | undefined;
}
