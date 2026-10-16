import { involves, type Rehearsal } from '../domain/rehearsal';
import type { RehearsalRepository } from '../domain/rehearsal-repository';
import { canMoveRehearsalsOf } from '../domain/singer';
import type { SingerRepository } from '../domain/singer-repository';
import type { SmsSender } from './ports/sms-sender';

export class MoveRehearsal {
  constructor(
    private readonly rehearsals: RehearsalRepository,
    private readonly singers: SingerRepository,
    private readonly sms: SmsSender,
  ) {}

  async execute(rehearsalId: string, leaderId: string, newStart: Date): Promise<{ rehearsal: Rehearsal; notified: number }> {
    const rehearsal = await this.rehearsals.findById(rehearsalId);
    if (rehearsal === undefined) throw new Error(`unknown rehearsal ${rehearsalId}`);
    if (rehearsal.cancelled) throw new Error('a cancelled rehearsal cannot be moved');
    const leader = await this.singers.findById(leaderId);
    if (leader === undefined) throw new Error(`unknown singer ${leaderId}`);
    if (!involves(rehearsal, leader.section) || !canMoveRehearsalsOf(leader, leader.section)) {
      throw new Error(`${leader.name} does not lead a section of this rehearsal`);
    }
    rehearsal.startsAt = newStart;
    await this.rehearsals.save(rehearsal);
    let notified = 0;
    for (const singer of await this.singers.findBySection(leader.section)) {
      await this.sms.send(singer.phone, `The ${leader.section} rehearsal at ${rehearsal.venue} has moved to ${newStart.toDateString()}.`);
      notified++;
    }
    return { rehearsal, notified };
  }
}
