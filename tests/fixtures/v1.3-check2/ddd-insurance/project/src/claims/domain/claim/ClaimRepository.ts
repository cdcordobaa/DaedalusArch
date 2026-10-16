import { Claim } from './Claim';

export interface ClaimRepository {
  byId(id: string): Promise<Claim | undefined>;
  save(claim: Claim): Promise<void>;
}
