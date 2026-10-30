import { Claim } from '../../../domain/claim';

export interface ClaimFilesPort {
  claim(ref: string): Promise<Claim>;
}
