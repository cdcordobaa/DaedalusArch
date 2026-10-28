import type { PontoonView } from '../contracts/PontoonView';
import type { PontoonRepository } from '../domain/pontoon/PontoonRepository';
import type { GateRegister } from './ports/GateRegister';

export class BerthQueries {
  constructor(
    private readonly pontoons: PontoonRepository,
    private readonly gate: GateRegister,
  ) {}

  pontoon(pontoonId: string): PontoonView | undefined {
    const p = this.pontoons.get(pontoonId);
    return p === undefined ? undefined : { id: p.id, name: p.name, berths: p.berthCount(), freeBerths: p.freeBerths() };
  }

  gateList(): string[] {
    return this.gate.entries();
  }
}
