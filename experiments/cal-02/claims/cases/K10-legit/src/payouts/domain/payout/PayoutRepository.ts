import { Payout } from "./Payout";

export interface PayoutRepository {
  save(payout: Payout): void;
  byId(id: string): Payout | undefined;
  byReference(reference: string): Payout | undefined;
}
