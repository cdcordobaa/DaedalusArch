import { Animal, markReady } from '../domain/animal';
import { AnimalRepository, IdGenerator } from './ports';

export interface RegisterAnimalInput {
  species: string;
  name: string;
  estimatedAgeYears: number;
  intakeDate: string;
  medicalNotes?: string;
}

export class AnimalService {
  constructor(private readonly animals: AnimalRepository, private readonly ids: IdGenerator) {}

  register(input: RegisterAnimalInput): Animal {
    if (!input.species || !input.name) throw new Error('species and name are required');
    const animal: Animal = {
      id: this.ids.next(),
      species: input.species,
      name: input.name,
      estimatedAgeYears: input.estimatedAgeYears,
      intakeDate: input.intakeDate,
      medicalNotes: input.medicalNotes ?? '',
      status: 'registered',
    };
    this.animals.save(animal);
    return animal;
  }

  markReady(id: string): Animal {
    const animal = this.get(id);
    const updated = markReady(animal);
    this.animals.save(updated);
    return updated;
  }

  get(id: string): Animal {
    const animal = this.animals.findById(id);
    if (!animal) throw new NotFoundError(`Animal ${id} not found`);
    return animal;
  }

  list(): Animal[] {
    return this.animals.findAll();
  }
}

export class NotFoundError extends Error {}
