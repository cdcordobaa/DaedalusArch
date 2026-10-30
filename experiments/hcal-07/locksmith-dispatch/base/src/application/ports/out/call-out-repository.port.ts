import { CallOut } from '../../../domain/call-out';

export interface CallOutRepositoryPort {
  findById(id: string): Promise<CallOut | null>;
  findByVisitRef(visitRef: string): Promise<CallOut | null>;
  save(callOut: CallOut): Promise<void>;
}
