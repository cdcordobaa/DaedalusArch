import { markAdopted } from '../domain/animal';
import { AdoptionApplication, Applicant, decide } from '../domain/adoption-application';
import { AnimalRepository, ApplicationRepository, CarerRepository, IdGenerator, PlacementRepository, UnitOfWork } from './ports';
import { NotificationService } from './notification-service';
import { NotFoundError } from './animal-service';
import { AuditService } from './audit-service';

export class AdoptionService {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly applications: ApplicationRepository,
    private readonly notifications: NotificationService,
    private readonly ids: IdGenerator,
    private readonly placements: PlacementRepository,
    private readonly carers: CarerRepository,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
    private readonly now: () => Date = () => new Date(),
  ) {}

  submit(actor: string, animalId: string, applicant: Applicant): AdoptionApplication {
    const animal = this.animals.findById(animalId);
    if (!animal) throw new NotFoundError(`Animal ${animalId} not found`);
    if (animal.status !== 'ready') throw new Error('Animal is not available for adoption');
    if (!applicant.email) throw new Error('applicant email is required');
    const app: AdoptionApplication = {
      id: this.ids.next(),
      animalId,
      applicant,
      status: 'open',
      submittedAt: this.now().toISOString(),
    };
    return this.uow.run(() => {
      this.applications.save(app);
      this.audit.record(actor, 'application', app.id, animalId, null, app);
      return app;
    });
  }

  approve(actor: string, applicationId: string): AdoptionApplication {
    const app = this.getApplication(applicationId);
    const animal = this.animals.findById(app.animalId);
    if (!animal) throw new NotFoundError(`Animal ${app.animalId} not found`);
    const at = this.now().toISOString();
    return this.uow.run(() => {
      const approved = decide(app, 'approved', at);
      const adopted = markAdopted(animal);
      this.animals.save(adopted);
      this.audit.record(actor, 'animal', animal.id, animal.id, animal, adopted);
      this.applications.save(approved);
      this.audit.record(actor, 'application', app.id, animal.id, app, approved);
      this.notify(actor, approved, animal.name);
      const placement = this.placements.findActiveByAnimal(animal.id);
      if (placement) {
        const ended = { ...placement, endedAt: at };
        this.placements.save(ended);
        this.audit.record(actor, 'placement', placement.id, animal.id, placement, ended);
        const carer = this.carers.findById(placement.carerId);
        if (carer) {
          this.notifications.notify(
            actor,
            carer,
            `${animal.name} has been adopted`,
            `Dear ${carer.name}, ${animal.name} has been adopted. Thank you for fostering! The placement has ended.`,
            animal.id,
          );
        }
      }
      for (const other of this.applications.findByAnimal(animal.id)) {
        if (other.id !== approved.id && other.status === 'open') {
          const rejected = decide(other, 'rejected', at);
          this.applications.save(rejected);
          this.audit.record(actor, 'application', other.id, animal.id, other, rejected);
          this.notify(actor, rejected, animal.name);
        }
      }
      return approved;
    });
  }

  reject(actor: string, applicationId: string): AdoptionApplication {
    const app = this.getApplication(applicationId);
    const rejected = decide(app, 'rejected', this.now().toISOString());
    return this.uow.run(() => {
      this.applications.save(rejected);
      this.audit.record(actor, 'application', app.id, app.animalId, app, rejected);
      const animal = this.animals.findById(app.animalId);
      this.notify(actor, rejected, animal?.name ?? 'the animal');
      return rejected;
    });
  }

  listForAnimal(animalId: string): AdoptionApplication[] {
    return this.applications.findByAnimal(animalId);
  }

  private getApplication(id: string): AdoptionApplication {
    const app = this.applications.findById(id);
    if (!app) throw new NotFoundError(`Application ${id} not found`);
    return app;
  }

  private notify(actor: string, app: AdoptionApplication, animalName: string): void {
    const outcome = app.status === 'approved' ? 'approved' : 'not successful';
    this.notifications.notify(
      actor,
      app.applicant,
      `Your adoption application for ${animalName}`,
      `Dear ${app.applicant.name}, your application to adopt ${animalName} was ${outcome}.`,
      app.animalId,
    );
  }
}
