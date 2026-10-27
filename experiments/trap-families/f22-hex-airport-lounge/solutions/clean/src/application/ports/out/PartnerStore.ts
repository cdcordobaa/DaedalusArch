import type { PartnerRule } from '../../../domain/model/PartnerRule';

export interface PartnerStore {
  save(rule: PartnerRule): void;
  get(airline: string): PartnerRule | null;
}
