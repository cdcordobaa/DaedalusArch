import type { CostumeHire } from '../../../domain/model/CostumeHire';

export interface CostumeHires {
  save(hire: CostumeHire): Promise<void>;
  get(hireId: string): Promise<CostumeHire | null>;
}
