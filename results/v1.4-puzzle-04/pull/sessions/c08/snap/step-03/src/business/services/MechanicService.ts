import type { MechanicGateway } from '../../persistence/MechanicGateway';
import { WorkshopError } from '../errors/WorkshopError';

export interface MechanicView {
  readonly id: string;
  readonly name: string;
}

export class MechanicService {
  constructor(private readonly mechanics: MechanicGateway) {}

  hire(name: string): MechanicView {
    if (name.trim() === '') throw new WorkshopError('a mechanic needs a name');
    return this.mechanics.insert(name.trim());
  }

  all(): MechanicView[] {
    return this.mechanics.all();
  }

  mechanic(id: string): MechanicView {
    const m = this.mechanics.byId(id);
    if (m === undefined) throw new WorkshopError(`no mechanic ${id}`);
    return m;
  }
}
