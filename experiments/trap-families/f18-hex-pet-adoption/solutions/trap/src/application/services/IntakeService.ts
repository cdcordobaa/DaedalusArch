import { ShelterError } from '../../domain/errors/ShelterError';
import { Adopter } from '../../domain/model/Adopter';
import { Pet } from '../../domain/model/Pet';
import type { Intake, PetView } from '../ports/in/Intake';
import type { AdopterStore } from '../ports/out/AdopterStore';
import type { Clock } from '../ports/out/Clock';
import type { PetStore } from '../ports/out/PetStore';

export class IntakeService implements Intake {
  constructor(
    private readonly pets: PetStore,
    private readonly adopters: AdopterStore,
    private readonly clock: Clock,
  ) {}

  admitPet(name: string, species: string): { id: string } {
    const pet = Pet.admit(this.pets.nextId(), name, species, this.clock.today());
    this.pets.save(pet);
    return { id: pet.id };
  }

  registerAdopter(name: string): { id: string } {
    const adopter = Adopter.register(this.adopters.nextId(), name);
    this.adopters.save(adopter);
    return { id: adopter.id };
  }

  pet(id: string): PetView {
    const pet = this.pets.byId(id);
    if (pet === undefined) throw new ShelterError(`no pet ${id}`);
    return { id: pet.id, name: pet.name, species: pet.species, status: pet.status, arrivedOn: pet.arrivedOn, adoptedOn: pet.adoptedOn };
  }
}
