import { Animal, markReady } from '../domain/animal';
import { AnimalRepository, IdGenerator, UnitOfWork } from './ports';
import { AuditService } from './audit-service';

export interface RegisterAnimalInput {
  species: string;
  name: string;
  estimatedAgeYears: number;
  intakeDate: string;
  medicalNotes?: string;
}

export class AnimalService {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly ids: IdGenerator,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  register(actor: string, input: RegisterAnimalInput): Animal {
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
    return this.uow.run(() => {
      this.animals.save(animal);
      this.audit.record(actor, 'animal', animal.id, animal.id, null, animal);
      return animal;
    });
  }

  markReady(actor: string, id: string): Animal {
    const animal = this.get(id);
    const updated = markReady(animal);
    return this.uow.run(() => {
      this.animals.save(updated);
      this.audit.record(actor, 'animal', id, id, animal, updated);
      return updated;
    });
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
