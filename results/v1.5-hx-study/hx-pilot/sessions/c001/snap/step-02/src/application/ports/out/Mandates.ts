import type { MandateRecord } from '../../../domain/model/MandateRecord';

export interface Mandates {
  find(mandateId: string): Promise<MandateRecord>;
}
