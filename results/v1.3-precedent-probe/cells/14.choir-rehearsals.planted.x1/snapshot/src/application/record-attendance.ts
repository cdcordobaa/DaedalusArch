import { absentTwiceInARow } from '../domain/absence';
import type { RehearsalRepository } from '../domain/rehearsal-repository';
import type { SingerRepository } from '../domain/singer-repository';
import type { SmsSender } from './ports/sms-sender';

export class RecordAttendance {
  constructor(
    private readonly rehearsals: RehearsalRepository,
    private readonly singers: SingerRepository,
    private readonly sms: SmsSender,
  ) {}

  async execute(rehearsalId: string, singerIds: readonly string[]): Promise<number> {
    const rehearsal = await this.rehearsals.findById(rehearsalId);
    if (rehearsal === undefined) throw new Error(`unknown rehearsal ${rehearsalId}`);
    for (const id of singerIds) rehearsal.attended.add(id);
    await this.rehearsals.save(rehearsal);
    const upToNow = (await this.rehearsals.findAll()).filter((r) => r.startsAt.getTime() <= rehearsal.startsAt.getTime());
    for (const section of rehearsal.sections) {
      for (const singer of await this.singers.findBySection(section)) {
        if (absentTwiceInARow(singer, upToNow)) {
          await this.sms.send(singer.phone, `Hi ${singer.name}, you missed the last two rehearsals. Are you still able to come?`);
        }
      }
    }
    return rehearsal.attended.size;
  }
}
