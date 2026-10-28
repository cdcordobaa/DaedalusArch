import type { Backer } from './Backer';
import type { BackerId } from './value-objects/BackerId';

export interface BackerRepository {
  allocateId(): BackerId;
  find(id: BackerId): Backer | undefined;
  save(backer: Backer): void;
}
