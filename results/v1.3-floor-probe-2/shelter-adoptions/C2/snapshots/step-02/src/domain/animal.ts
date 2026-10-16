export type AnimalStatus = 'intake' | 'ready' | 'adopted';

export interface Animal {
  id: string;
  species: string;
  name: string;
  estimatedAgeYears: number;
  intakeDate: string;
  medicalNotes: string;
  status: AnimalStatus;
}

export function markReady(a: Animal): Animal {
  if (a.status === 'adopted') throw new DomainError('animal already adopted');
  return { ...a, status: 'ready' };
}

export class DomainError extends Error {}
