import { Animal } from '../domain/animal';
import { NotFound } from '../domain/errors';
import { AnimalManagement, NewAnimal } from './ports/inbound';
import { AnimalStore, IdFactory } from './ports/outbound';
import { AuditService } from './audit';

export class AnimalManagementService implements AnimalManagement {
  constructor(private readonly animals: AnimalStore, private readonly ids: IdFactory, private readonly audit: AuditService) {}

  register(input: NewAnimal, staffId: string): Animal {
    const a = new Animal(this.ids.newId(), input.species, input.name, input.estimatedAge, input.intakeDate, input.medicalNotes ?? '');
    this.audit.record(staffId, 'animal', a.id, a.id, null, () => this.animals.save(a), () => a);
    return a;
  }

  markReady(animalId: string, staffId: string): Animal {
    const a = this.get(animalId);
    this.audit.record(staffId, 'animal', a.id, a.id, a, () => { a.markReady(); this.animals.save(a); }, () => a);
    return a;
  }

  list(): Animal[] { return this.animals.all(); }

  get(animalId: string): Animal {
    const a = this.animals.find(animalId);
    if (!a) throw new NotFound(`animal ${animalId}`);
    return a;
  }
}
