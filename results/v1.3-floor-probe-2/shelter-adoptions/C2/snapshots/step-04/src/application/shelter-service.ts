import { Animal, DomainError, markReady } from '../domain/animal';
import { AdoptionApplication, decide } from '../domain/application';
import { RegisterAnimalInput, ShelterUseCases, SubmitApplicationInput } from '../ports/in/shelter';
import { AnimalRepository, ApplicationRepository } from '../ports/out/repositories';
import { Notifier } from '../ports/in/notifications';
import { Clock, IdGenerator } from '../ports/out/clock';
import { UnitOfWork } from '../ports/out/audit';
import { Auditor } from './auditor';

export class NotFoundError extends Error {}

/** Hook run after an adoption is approved (the foster network ends the placement). */
export interface AdoptionListener { onAdopted(animalId: string, animalName: string, actor: string): void }

export class ShelterService implements ShelterUseCases {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly applications: ApplicationRepository,
    private readonly notifier: Notifier,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly auditor: Auditor,
    private readonly uow: UnitOfWork,
    private readonly listeners: AdoptionListener[] = [],
  ) {}

  registerAnimal(input: RegisterAnimalInput, actor: string): Animal {
    const a: Animal = {
      id: this.ids.next('ani'), species: input.species, name: input.name, estimatedAgeYears: input.estimatedAgeYears,
      intakeDate: input.intakeDate, medicalNotes: input.medicalNotes ?? '', status: 'intake',
    };
    this.uow.run(() => {
      this.animals.save(a);
      this.auditor.record(actor, 'animal', a.id, null, a, a.id);
    });
    return a;
  }

  markReady(animalId: string, actor: string): Animal {
    const before = this.animal(animalId);
    const a = markReady(before);
    this.uow.run(() => {
      this.animals.save(a);
      this.auditor.record(actor, 'animal', a.id, before, a, a.id);
    });
    return a;
  }

  listAnimals(): Animal[] { return this.animals.list(); }

  submitApplication(input: SubmitApplicationInput, actor: string): AdoptionApplication {
    const animal = this.animal(input.animalId);
    if (animal.status !== 'ready') throw new DomainError('animal is not ready for adoption');
    const app: AdoptionApplication = { id: this.ids.next('app'), ...input, status: 'open', submittedAt: this.clock.now() };
    this.uow.run(() => {
      this.applications.save(app);
      this.auditor.record(actor, 'application', app.id, null, app, app.animalId);
    });
    return app;
  }

  approve(applicationId: string, actor: string): AdoptionApplication {
    const before = this.application(applicationId);
    const app = decide(before, 'approved', this.clock.now());
    const animal = this.animal(app.animalId);
    if (animal.status !== 'ready') throw new DomainError('animal is not available');
    const adopted = { ...animal, status: 'adopted' as const };
    const rejected: AdoptionApplication[] = [];
    this.uow.run(() => {
      this.applications.save(app);
      this.auditor.record(actor, 'application', app.id, before, app, animal.id);
      this.animals.save(adopted);
      this.auditor.record(actor, 'animal', animal.id, animal, adopted, animal.id);
      for (const other of this.applications.byAnimal(animal.id)) {
        if (other.id !== app.id && other.status === 'open') {
          const r = decide(other, 'rejected', this.clock.now());
          this.applications.save(r);
          this.auditor.record(actor, 'application', r.id, other, r, animal.id);
          rejected.push(r);
        }
      }
      for (const l of this.listeners) l.onAdopted(animal.id, animal.name, actor);
    });
    this.notify(app, animal);
    for (const r of rejected) this.notify(r, animal);
    return app;
  }

  reject(applicationId: string, actor: string): AdoptionApplication {
    const before = this.application(applicationId);
    const app = decide(before, 'rejected', this.clock.now());
    this.uow.run(() => {
      this.applications.save(app);
      this.auditor.record(actor, 'application', app.id, before, app, app.animalId);
    });
    this.notify(app, this.animal(app.animalId));
    return app;
  }

  applicationsFor(animalId: string): AdoptionApplication[] { return this.applications.byAnimal(animalId); }

  private notify(app: AdoptionApplication, animal: Animal): void {
    void this.notifier.notify({ name: app.applicantName, email: app.email, phone: app.phone, preferredChannel: app.notifyBy },
      `Application for ${animal.name}`, `Dear ${app.applicantName}, your adoption application for ${animal.name} was ${app.status}.`);
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
