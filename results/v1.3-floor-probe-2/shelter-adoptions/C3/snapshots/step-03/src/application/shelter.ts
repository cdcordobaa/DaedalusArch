import { Animal, Animals, Applicant, Application, Applications, HouseholdInfo, ShelterError } from '../domain/model';
import { AnimalRepository, ApplicationRepository } from '../domain/ports/repositories';
import { Clock, Ids } from './ports';
import { Notifier } from './notifier';

export interface AnimalInput { species: string; name: string; estimatedAge: number; intakeDate: string; medicalNotes?: string }

export type AdoptedHook = (animalId: string, animalName: string) => void;

export class Shelter {
  private readonly adoptedHooks: AdoptedHook[] = [];

  constructor(
    private readonly animals: AnimalRepository,
    private readonly applications: ApplicationRepository,
    private readonly notifier: Notifier,
    private readonly clock: Clock,
    private readonly ids: Ids,
  ) {}

  whenAdopted(hook: AdoptedHook): void { this.adoptedHooks.push(hook); }

  registerAnimal(i: AnimalInput): Animal {
    if (!i.species || !i.name) throw new ShelterError('species and name are required', 'invalid');
    const a: Animal = { id: this.ids.next(), species: i.species, name: i.name, estimatedAge: i.estimatedAge, intakeDate: i.intakeDate, medicalNotes: i.medicalNotes ?? '', state: 'registered' };
    this.animals.put(a);
    return a;
  }

  markReady(animalId: string): Animal {
    const a = Animals.ready(this.animal(animalId));
    this.animals.put(a);
    return a;
  }

  listAnimals(): Animal[] { return this.animals.all(); }

  submitApplication(animalId: string, applicant: Applicant, household: HouseholdInfo): Application {
    if (this.animal(animalId).state !== 'ready') throw new ShelterError('animal is not available for adoption');
    const app: Application = { id: this.ids.next(), animalId, applicant, household, state: 'open', submittedAt: this.clock.now() };
    this.applications.put(app);
    return app;
  }

  approve(applicationId: string): Application {
    const approved = Applications.decide(this.application(applicationId), 'approved', this.clock.now());
    const animal = Animals.adopted(this.animal(approved.animalId));
    this.applications.put(approved);
    this.animals.put(animal);
    for (const h of this.adoptedHooks) h(animal.id, animal.name);
    this.notify(approved, animal);
    for (const other of this.applications.ofAnimal(animal.id).filter((x) => x.id !== approved.id && x.state === 'open')) {
      const rejected = Applications.decide(other, 'rejected', this.clock.now());
      this.applications.put(rejected);
      this.notify(rejected, animal);
    }
    return approved;
  }

  reject(applicationId: string): Application {
    const rejected = Applications.decide(this.application(applicationId), 'rejected', this.clock.now());
    this.applications.put(rejected);
    this.notify(rejected, this.animal(rejected.animalId));
    return rejected;
  }

  applicationsOf(animalId: string): Application[] { return this.applications.ofAnimal(animalId); }

  private notify(app: Application, animal: Animal): void {
    void this.notifier.notify(app.applicant, `Adoption of ${animal.name}: ${app.state}`,
      `Hi ${app.applicant.name}, your application to adopt ${animal.name} has been ${app.state}.`);
  }

  private animal(id: string): Animal {
    const a = this.animals.get(id);
    if (!a) throw new ShelterError(`animal ${id} not found`, 'not-found');
    return a;
  }

  private application(id: string): Application {
    const a = this.applications.get(id);
    if (!a) throw new ShelterError(`application ${id} not found`, 'not-found');
    return a;
  }
}
