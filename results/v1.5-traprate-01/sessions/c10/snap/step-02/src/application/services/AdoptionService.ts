import { ShelterError } from '../../domain/errors/ShelterError';
import { AdoptionApplication } from '../../domain/model/AdoptionApplication';
import type { Adoptions, ApplicationView } from '../ports/in/Adoptions';
import type { AdopterStore } from '../ports/out/AdopterStore';
import type { ApplicationStore } from '../ports/out/ApplicationStore';
import type { Clock } from '../ports/out/Clock';
import type { PetStore } from '../ports/out/PetStore';

const view = (a: AdoptionApplication): ApplicationView => ({ id: a.id, petId: a.petId, adopterId: a.adopterId, submittedOn: a.submittedOn, status: a.status });

export class AdoptionService implements Adoptions {
  constructor(
    private readonly pets: PetStore,
    private readonly adopters: AdopterStore,
    private readonly applications: ApplicationStore,
    private readonly clock: Clock,
  ) {}

  apply(petId: string, adopterId: string): { id: string } {
    const pet = this.pets.byId(petId);
    if (pet === undefined) throw new ShelterError(`no pet ${petId}`);
    if (this.adopters.byId(adopterId) === undefined) throw new ShelterError(`no adopter ${adopterId}`);
    if (!pet.isAvailable()) throw new ShelterError(`pet ${petId} is adopted`);
    if (this.applications.forPet(petId).some((a) => a.isPending() && a.adopterId === adopterId)) {
      throw new ShelterError(`adopter ${adopterId} already applied for ${petId}`);
    }
    const application = AdoptionApplication.submit(this.applications.nextId(), petId, adopterId, this.clock.today());
    this.applications.save(application);
    return { id: application.id };
  }

  approve(applicationId: string): ApplicationView {
    const application = this.find(applicationId);
    const pet = this.pets.byId(application.petId);
    if (pet === undefined) throw new ShelterError(`no pet ${application.petId}`);
    application.approve();
    pet.adopt(this.clock.today());
    for (const other of this.applications.forPet(pet.id)) {
      if (other.id !== application.id && other.isPending()) {
        other.reject();
        this.applications.save(other);
      }
    }
    this.applications.save(application);
    this.pets.save(pet);
    return view(application);
  }

  withdraw(applicationId: string): ApplicationView {
    const application = this.find(applicationId);
    application.withdraw();
    this.applications.save(application);
    return view(application);
  }

  application(id: string): ApplicationView {
    return view(this.find(id));
  }

  private find(id: string): AdoptionApplication {
    const application = this.applications.byId(id);
    if (application === undefined) throw new ShelterError(`no application ${id}`);
    return application;
  }
}
