export type AnimalStatus = 'registered' | 'ready' | 'adopted';

export interface Animal {
  id: string;
  species: string;
  name: string;
  estimatedAgeYears: number;
  intakeDate: string;
  medicalNotes: string;
  status: AnimalStatus;
}

export function markReady(animal: Animal): Animal {
  if (animal.status === 'adopted') throw new Error('Animal is already adopted');
  return { ...animal, status: 'ready' };
}

export function markAdopted(animal: Animal): Animal {
  if (animal.status !== 'ready') throw new Error('Animal is not ready for adoption');
  return { ...animal, status: 'adopted' };
}
