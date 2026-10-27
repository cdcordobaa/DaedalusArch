import type { SigningOutcome } from '../../../domain/model/SigningOutcome';

export interface RecordSigningOutcome {
  record(signingRef: string, outcome: SigningOutcome): Promise<void>;
}
