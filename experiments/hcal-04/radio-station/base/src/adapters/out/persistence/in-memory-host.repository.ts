import type { HostRepository } from '../../../application/ports/out/host.repository';
import type { Host } from '../../../domain/host';

export class InMemoryHostRepository implements HostRepository {
  constructor(private readonly hosts: readonly Host[]) {}

  async findById(id: string): Promise<Host | undefined> {
    return this.hosts.find((h) => h.id === id);
  }
}
