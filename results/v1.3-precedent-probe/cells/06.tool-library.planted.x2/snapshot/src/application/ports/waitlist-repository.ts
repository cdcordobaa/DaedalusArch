import type { WaitlistEntry } from '../../domain/waitlist';

export interface WaitlistRepository {
  forTool(toolId: string): Promise<WaitlistEntry[]>;
  add(entry: WaitlistEntry): Promise<void>;
  remove(toolId: string, memberId: string): Promise<void>;
}
