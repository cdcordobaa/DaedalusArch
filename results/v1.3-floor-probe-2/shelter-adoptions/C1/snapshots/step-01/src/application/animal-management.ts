import { Animal } from '../domain/animal';
import { NotFound } from '../domain/errors';
import { AnimalManagement, NewAnimal } from './ports/inbound';
import { AnimalStore, IdFactory } from './ports/outbound';

export class AnimalManagementService implements AnimalManagement {
  constructor(private readonly animals: AnimalStore, private readonly ids: IdFactory) {}

  register(input: NewAnimal): Animal {
    const a = new Animal(this.ids.newId(), input.species, input.name, input.estimatedAge, input.intakeDate, input.medicalNotes ?? '');
    this.animals.save(a);
    return a;
  }

  markReady(animalId: string): Animal {
    const a = this.get(animalId);
    a.markReady();
    this.animals.save(a);
    return a;
  }

  list(): Animal[] { return this.animals.all(); }

  get(animalId: string): Animal {
    const a = this.animals.find(animalId);
    if (!a) throw new NotFound(`animal ${animalId}`);
    return a;
  }
}
