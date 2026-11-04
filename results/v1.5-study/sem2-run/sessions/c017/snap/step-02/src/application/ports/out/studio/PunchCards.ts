import type { PunchCard } from '../../../../domain/model/studio/PunchCard';

export interface PunchCards {
  byMember(memberId: string): Promise<PunchCard | undefined>;
  write(card: PunchCard): Promise<void>;
}
