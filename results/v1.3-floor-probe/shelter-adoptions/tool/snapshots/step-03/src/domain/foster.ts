export interface FosterCarer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  preferredChannel?: 'email' | 'sms';
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

export function isActive(p: Placement): boolean {
  return p.endedAt === undefined;
}

export function canHost(carer: FosterCarer, species: string, activePlacements: number): boolean {
  return carer.species.includes(species) && activePlacements < carer.capacity;
}
