import { Claim } from "../domain/claim/Claim";

export interface ClaimDetails {
  readonly claim: Claim;
  readonly note: string;
}
