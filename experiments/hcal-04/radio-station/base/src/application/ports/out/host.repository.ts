import type { Host } from '../../../domain/host';

export interface HostRepository {
  findById(id: string): Promise<Host | undefined>;
}
