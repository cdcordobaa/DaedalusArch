import type { WaitlistRepository } from '../../application/ports/waitlist-repository';
import type { WaitlistEntry } from '../../domain/waitlist';

export class InMemoryWaitlistRepository implements WaitlistRepository {
  private entries: WaitlistEntry[] = [];

  async forTool(toolId: string): Promise<WaitlistEntry[]> {
    return this.entries.filter((e) => e.toolId === toolId);
  }

  async add(entry: WaitlistEntry): Promise<void> {
    this.entries.push(entry);
  }

  async remove(toolId: string, memberId: string): Promise<void> {
    this.entries = this.entries.filter((e) => !(e.toolId === toolId && e.memberId === memberId));
  }
}
