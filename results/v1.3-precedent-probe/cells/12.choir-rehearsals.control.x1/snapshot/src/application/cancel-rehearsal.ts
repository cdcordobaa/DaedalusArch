import type { RehearsalRepository } from '../domain/rehearsal-repository';
import type { SingerRepository } from '../domain/singer-repository';
import type { SmsSender } from './ports/sms-sender';

export class CancelRehearsal {
  constructor(
    private readonly rehearsals: RehearsalRepository,
    private readonly singers: SingerRepository,
    private readonly sms: SmsSender,
  ) {}

  async execute(rehearsalId: string, reason: string): Promise<number> {
    const rehearsal = await this.rehearsals.findById(rehearsalId);
    if (rehearsal === undefined) throw new Error(`unknown rehearsal ${rehearsalId}`);
    rehearsal.cancelled = true;
    await this.rehearsals.save(rehearsal);
    let notified = 0;
    for (const section of rehearsal.sections) {
      for (const singer of await this.singers.findBySection(section)) {
        await this.sms.send(singer.phone, `Rehearsal on ${rehearsal.startsAt.toDateString()} is cancelled: ${reason}`);
        notified++;
      }
    }
    return notified;
  }
}
