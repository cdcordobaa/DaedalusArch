import { involves, reschedule, type Rehearsal } from '../domain/rehearsal';
import type { RehearsalRepository } from '../domain/rehearsal-repository';
import type { SingerRepository } from '../domain/singer-repository';
import type { SmsSender } from './ports/sms-sender';

export class RescheduleRehearsal {
  constructor(
    private readonly rehearsals: RehearsalRepository,
    private readonly singers: SingerRepository,
    private readonly sms: SmsSender,
  ) {}

  async execute(rehearsalId: string, leaderId: string, newStart: Date, now = new Date()): Promise<Rehearsal> {
    const leader = await this.singers.findById(leaderId);
    if (leader === undefined || leader.isSectionLeader !== true) throw new Error('only a section leader can move a rehearsal');
    const rehearsal = await this.rehearsals.findById(rehearsalId);
    if (rehearsal === undefined) throw new Error(`unknown rehearsal ${rehearsalId}`);
    if (!involves(rehearsal, leader.section)) throw new Error(`this rehearsal is not for the ${leader.section} section`);
    reschedule(rehearsal, newStart, now);
    await this.rehearsals.save(rehearsal);
    for (const singer of await this.singers.findBySection(leader.section)) {
      await this.sms.send(singer.phone, `Your ${leader.section} rehearsal has moved to ${newStart.toDateString()} (${rehearsal.venue}).`);
    }
    return rehearsal;
  }
}
