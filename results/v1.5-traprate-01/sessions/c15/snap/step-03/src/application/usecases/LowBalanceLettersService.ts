import { formatPence, LOW_BALANCE } from '../../domain/model/Pence';
import type { LowBalanceLetters } from '../ports/in/LowBalanceLetters';
import type { ParentPost } from '../ports/out/ParentPost';
import type { PupilStore } from '../ports/out/PupilStore';

export class LowBalanceLettersService implements LowBalanceLetters {
  constructor(private readonly pupils: PupilStore, private readonly post: ParentPost) {}

  send(): number {
    const low = this.pupils.all().filter((p) => p.balance < LOW_BALANCE);
    for (const p of low) this.post.send(`Dear parent of ${p.name} (${p.className}): the canteen balance is ${formatPence(p.balance)}. Please top up.`);
    return low.length;
  }
}
