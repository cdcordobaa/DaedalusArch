import { ClaimStatus } from "../domain/claim/Claim";

export interface ClaimNotifier {
  notify(claimId: string, status: ClaimStatus, note: string): void;
}
