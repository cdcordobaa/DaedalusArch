import { AdoptionApplication, Contact, Household } from '../domain/adoption-application';
import { Animal } from '../domain/animal';
import { InvalidOperation, NotFound } from '../domain/errors';
import { Adoptions } from './ports/inbound';
import { AnimalStore, ApplicationStore, Clock, IdFactory } from './ports/outbound';
import { NotificationService } from './notifications';
import { FosteringService } from './fostering';

export class AdoptionService implements Adoptions {
  constructor(
    private readonly animals: AnimalStore,
    private readonly applications: ApplicationStore,
    private readonly notifications: NotificationService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly fostering?: FosteringService,
  ) {}

  apply(animalId: string, applicant: Contact, household: Household): AdoptionApplication {
    const animal = this.animal(animalId);
    if (animal.status !== 'ready-for-adoption') throw new InvalidOperation('animal is not open for adoption');
    const app = new AdoptionApplication(this.ids.newId(), animalId, applicant, household, this.clock.nowIso());
    this.applications.save(app);
    return app;
  }

  approve(applicationId: string): AdoptionApplication {
    const app = this.application(applicationId);
    const animal = this.animal(app.animalId);
    const now = this.clock.nowIso();
    app.approve(now);
    animal.adopt();
    this.applications.save(app);
    this.animals.save(animal);
    this.fostering?.animalAdopted(animal.id, animal.name);
    this.tell(app, animal);
    for (const other of this.applications.forAnimal(animal.id)) {
      if (other.id !== app.id && other.isOpen) {
        other.reject(now);
        this.applications.save(other);
        this.tell(other, animal);
      }
    }
    return app;
  }

  reject(applicationId: string): AdoptionApplication {
    const app = this.application(applicationId);
    app.reject(this.clock.nowIso());
    this.applications.save(app);
    this.tell(app, this.animal(app.animalId));
    return app;
  }

  forAnimal(animalId: string): AdoptionApplication[] { return this.applications.forAnimal(animalId); }

  private tell(app: AdoptionApplication, animal: Animal): void {
    const verdict = app.decision === 'approved' ? 'has been approved' : 'was not successful';
    void this.notifications.notify(app.applicant, `Adopting ${animal.name}`, `Hello ${app.applicant.name}, your application to adopt ${animal.name} ${verdict}.`);
  }

  private animal(id: string): Animal {
    const a = this.animals.find(id);
    if (!a) throw new NotFound(`animal ${id}`);
    return a;
  }

  private application(id: string): AdoptionApplication {
    const a = this.applications.find(id);
    if (!a) throw new NotFound(`application ${id}`);
    return a;
  }
}
