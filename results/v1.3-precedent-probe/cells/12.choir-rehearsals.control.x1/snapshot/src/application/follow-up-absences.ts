import { missedTwoInARow } from '../domain/rehearsal';
import type { RehearsalRepository } from '../domain/rehearsal-repository';
import type { SingerRepository } from '../domain/singer-repository';
import type { SmsSender } from './ports/sms-sender';

/** After a rehearsal's attendance is in: text every singer who has now missed two rehearsals in a row. */
export class FollowUpAbsences {
  constructor(
    private readonly rehearsals: RehearsalRepository,
    private readonly singers: SingerRepository,
    private readonly sms: SmsSender,
  ) {}

  async execute(rehearsalId: string): Promise<string[]> {
    const rehearsal = await this.rehearsals.findById(rehearsalId);
    if (rehearsal === undefined) throw new Error(`unknown rehearsal ${rehearsalId}`);
    const history = await this.rehearsals.findAll();
    const texted: string[] = [];
    for (const section of rehearsal.sections) {
      for (const singer of await this.singers.findBySection(section)) {
        if (!missedTwoInARow(history, rehearsal, singer.id, section)) continue;
        await this.sms.send(singer.phone, `Hi ${singer.name}, we have missed you at the last two rehearsals. Are you still able to come?`);
        texted.push(singer.id);
      }
    }
    return texted;
  }
}
