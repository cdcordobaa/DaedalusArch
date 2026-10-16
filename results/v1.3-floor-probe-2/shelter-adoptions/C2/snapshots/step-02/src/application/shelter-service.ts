import { Animal, DomainError, markReady } from '../domain/animal';
import { AdoptionApplication, decide } from '../domain/application';
import { RegisterAnimalInput, ShelterUseCases, SubmitApplicationInput } from '../ports/in/shelter';
import { AnimalRepository, ApplicationRepository } from '../ports/out/repositories';
import { Mailer } from '../ports/out/mailer';
import { Clock, IdGenerator } from '../ports/out/clock';

export class NotFoundError extends Error {}

/** Hook run after an adoption is approved (the foster network ends the placement). */
export interface AdoptionListener { onAdopted(animalId: string, animalName: string): void }

export class ShelterService implements ShelterUseCases {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly applications: ApplicationRepository,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly listeners: AdoptionListener[] = [],
  ) {}

  registerAnimal(input: RegisterAnimalInput): Animal {
    const a: Animal = {
      id: this.ids.next('ani'), species: input.species, name: input.name, estimatedAgeYears: input.estimatedAgeYears,
      intakeDate: input.intakeDate, medicalNotes: input.medicalNotes ?? '', status: 'intake',
    };
    this.animals.save(a);
    return a;
  }

  markReady(animalId: string): Animal {
    const a = markReady(this.animal(animalId));
    this.animals.save(a);
    return a;
  }

  listAnimals(): Animal[] { return this.animals.list(); }

  submitApplication(input: SubmitApplicationInput): AdoptionApplication {
    const animal = this.animal(input.animalId);
    if (animal.status !== 'ready') throw new DomainError('animal is not ready for adoption');
    const app: AdoptionApplication = { id: this.ids.next('app'), ...input, status: 'open', submittedAt: this.clock.now() };
    this.applications.save(app);
    return app;
  }

  approve(applicationId: string): AdoptionApplication {
    const app = decide(this.application(applicationId), 'approved', this.clock.now());
    const animal = this.animal(app.animalId);
    if (animal.status !== 'ready') throw new DomainError('animal is not available');
    this.applications.save(app);
    this.animals.save({ ...animal, status: 'adopted' });
    this.notify(app, animal);
    for (const l of this.listeners) l.onAdopted(animal.id, animal.name);
    for (const other of this.applications.byAnimal(animal.id)) {
      if (other.id !== app.id && other.status === 'open') {
        const rejected = decide(other, 'rejected', this.clock.now());
        this.applications.save(rejected);
        this.notify(rejected, animal);
      }
    }
    return app;
  }

  reject(applicationId: string): AdoptionApplication {
    const app = decide(this.application(applicationId), 'rejected', this.clock.now());
    this.applications.save(app);
    this.notify(app, this.animal(app.animalId));
    return app;
  }

  applicationsFor(animalId: string): AdoptionApplication[] { return this.applications.byAnimal(animalId); }

  private notify(app: AdoptionApplication, animal: Animal): void {
    this.mailer.send(app.email, `Your application for ${animal.name}`,
      `Dear ${app.applicantName}, your adoption application for ${animal.name} was ${app.status}.`);
  }

  private animal(id: string): Animal {
    const a = this.animals.get(id);
    if (!a) throw new NotFoundError(`animal ${id} not found`);
    return a;
  }

  private application(id: string): AdoptionApplication {
    const a = this.applications.get(id);
    if (!a) throw new NotFoundError(`application ${id} not found`);
    return a;
  }
}
