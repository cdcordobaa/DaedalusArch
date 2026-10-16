import { DomainError } from './animal';

export interface FosterCarer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notifyBy?: 'email' | 'sms';
  capacity: number;
  species: string[];
}

export interface Placement {
  id: string;
  animalId: string;
  carerId: string;
  startedAt: string;
  endedAt?: string;
}

export function assertCanHost(carer: FosterCarer, species: string, activePlacements: number): void {
  if (!carer.species.includes(species)) throw new DomainError(`${carer.name} does not host ${species}`);
  if (activePlacements >= carer.capacity) throw new DomainError(`${carer.name} is at capacity (${carer.capacity})`);
}
