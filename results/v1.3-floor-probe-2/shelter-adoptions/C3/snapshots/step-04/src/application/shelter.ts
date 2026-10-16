import { Animal, Animals, Applicant, Application, Applications, HouseholdInfo, ShelterError } from '../domain/model';
import { AnimalRepository, ApplicationRepository } from '../domain/ports/repositories';
import { Clock, Ids } from './ports';
import { Notifier } from './notifier';
import { Audit } from './audit';

export interface AnimalInput { species: string; name: string; estimatedAge: number; intakeDate: string; medicalNotes?: string }

export type AdoptedHook = (animalId: string, animalName: string, by: string) => void;

export class Shelter {
  private readonly adoptedHooks: AdoptedHook[] = [];

  constructor(
    private readonly animals: AnimalRepository,
    private readonly applications: ApplicationRepository,
    private readonly notifier: Notifier,
    private readonly clock: Clock,
    private readonly ids: Ids,
    private readonly audit: Audit,
  ) {}

  whenAdopted(hook: AdoptedHook): void { this.adoptedHooks.push(hook); }

  registerAnimal(i: AnimalInput, by: string): Animal {
    if (!i.species || !i.name) throw new ShelterError('species and name are required', 'invalid');
    const a: Animal = { id: this.ids.next(), species: i.species, name: i.name, estimatedAge: i.estimatedAge, intakeDate: i.intakeDate, medicalNotes: i.medicalNotes ?? '', state: 'registered' };
    return this.audit.saved(by, 'animal', a.id, a.id, null, a, (x) => this.animals.put(x));
  }

  markReady(animalId: string, by: string): Animal {
    const before = this.animal(animalId);
    return this.audit.saved(by, 'animal', before.id, before.id, before, Animals.ready(before), (x) => this.animals.put(x));
  }

  listAnimals(): Animal[] { return this.animals.all(); }

  submitApplication(animalId: string, applicant: Applicant, household: HouseholdInfo, by: string): Application {
    if (this.animal(animalId).state !== 'ready') throw new ShelterError('animal is not available for adoption');
    const app: Application = { id: this.ids.next(), animalId, applicant, household, state: 'open', submittedAt: this.clock.now() };
    return this.audit.saved(by, 'application', app.id, animalId, null, app, (x) => this.applications.put(x));
  }

  approve(applicationId: string, by: string): Application {
    const open = this.application(applicationId);
    const approved = Applications.decide(open, 'approved', this.clock.now());
    const before = this.animal(approved.animalId);
    const animal = Animals.adopted(before);
    const others = this.applications.ofAnimal(animal.id).filter((x) => x.id !== approved.id && x.state === 'open');
    const rejected = others.map((o) => Applications.decide(o, 'rejected', this.clock.now()));
    this.audit.atomic(() => {
      this.audit.saved(by, 'application', approved.id, animal.id, open, approved, (x) => this.applications.put(x));
      this.audit.saved(by, 'animal', animal.id, animal.id, before, animal, (x) => this.animals.put(x));
      rejected.forEach((r, i) => this.audit.saved(by, 'application', r.id, animal.id, others[i], r, (x) => this.applications.put(x)));
      for (const h of this.adoptedHooks) h(animal.id, animal.name, by);
    });
    this.notify(approved, animal);
    for (const r of rejected) this.notify(r, animal);
    return approved;
  }

  reject(applicationId: string, by: string): Application {
    const open = this.application(applicationId);
    const rejected = this.audit.saved(by, 'application', open.id, open.animalId, open, Applications.decide(open, 'rejected', this.clock.now()), (x) => this.applications.put(x));
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
