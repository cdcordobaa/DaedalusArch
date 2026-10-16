import { markAdopted } from '../domain/animal';
import { AdoptionApplication, Applicant, decide } from '../domain/adoption-application';
import { AnimalRepository, ApplicationRepository, IdGenerator, Mailer } from './ports';
import { NotFoundError } from './animal-service';

export class AdoptionService {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly applications: ApplicationRepository,
    private readonly mailer: Mailer,
    private readonly ids: IdGenerator,
    private readonly now: () => Date = () => new Date(),
  ) {}

  submit(animalId: string, applicant: Applicant): AdoptionApplication {
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
    this.applications.save(app);
    return app;
  }

  approve(applicationId: string): AdoptionApplication {
    const app = this.getApplication(applicationId);
    const animal = this.animals.findById(app.animalId);
    if (!animal) throw new NotFoundError(`Animal ${app.animalId} not found`);
    const at = this.now().toISOString();
    const approved = decide(app, 'approved', at);
    this.animals.save(markAdopted(animal));
    this.applications.save(approved);
    this.notify(approved, animal.name);
    for (const other of this.applications.findByAnimal(animal.id)) {
      if (other.id !== approved.id && other.status === 'open') {
        const rejected = decide(other, 'rejected', at);
        this.applications.save(rejected);
        this.notify(rejected, animal.name);
      }
    }
    return approved;
  }

  reject(applicationId: string): AdoptionApplication {
    const app = this.getApplication(applicationId);
    const rejected = decide(app, 'rejected', this.now().toISOString());
    this.applications.save(rejected);
    const animal = this.animals.findById(app.animalId);
    this.notify(rejected, animal?.name ?? 'the animal');
    return rejected;
  }

  listForAnimal(animalId: string): AdoptionApplication[] {
    return this.applications.findByAnimal(animalId);
  }

  private getApplication(id: string): AdoptionApplication {
    const app = this.applications.findById(id);
    if (!app) throw new NotFoundError(`Application ${id} not found`);
    return app;
  }

  private notify(app: AdoptionApplication, animalName: string): void {
    const outcome = app.status === 'approved' ? 'approved' : 'not successful';
    this.mailer.send({
      to: app.applicant.email,
      subject: `Your adoption application for ${animalName}`,
      body: `Dear ${app.applicant.name}, your application to adopt ${animalName} was ${outcome}.`,
    });
  }
}
