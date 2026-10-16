import { markAdopted } from "../domain/animal.js";
import { decide, type AdoptionApplication, type Applicant, type Household } from "../domain/application.js";
import { parseChannel } from "../domain/notification.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { endPlacement } from "../domain/foster.js";
import type {
  AnimalRepository,
  ApplicationRepository,
  ChangeStore,
  Clock,
  FosterCarerRepository,
  IdGenerator,
  PlacementRepository,
} from "./ports.js";
import type { NotificationService } from "./notification-service.js";

export interface SubmitApplicationCommand {
  animalId: string;
  applicant: Applicant;
  household: Household;
}

export class ApplicationService {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly applications: ApplicationRepository,
    private readonly changes: ChangeStore,
    private readonly notifications: NotificationService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly placements: PlacementRepository,
    private readonly carers: FosterCarerRepository,
  ) {}

  async submit(cmd: SubmitApplicationCommand, actor: string): Promise<AdoptionApplication> {
    const { household } = cmd;
    const applicant = { ...cmd.applicant, notificationChannel: parseChannel(cmd.applicant.notificationChannel) };
    if (!applicant.name.trim()) throw new ValidationError("applicant.name is required");
    if (!/^[^@\s]+@[^@\s]+$/.test(applicant.email)) throw new ValidationError("applicant.email is invalid");
    if (!applicant.phone.trim()) throw new ValidationError("applicant.phone is required");
    if (!Number.isInteger(household.adults) || household.adults < 1) {
      throw new ValidationError("household.adults must be an integer >= 1");
    }
    if (!Number.isInteger(household.children) || household.children < 0) {
      throw new ValidationError("household.children must be an integer >= 0");
    }

    const animal = await this.animals.findById(cmd.animalId);
    if (!animal) throw new NotFoundError(`Animal ${cmd.animalId} not found`);
    if (animal.status !== "ready_for_adoption") {
      throw new ConflictError("Animal is not available for adoption");
    }

    const application: AdoptionApplication = {
      id: this.ids.next(),
      animalId: animal.id,
      applicant,
      household,
      status: "open",
      submittedAt: this.clock.now().toISOString(),
    };
    await this.changes.commit([{ entityType: "application", entity: application }], actor);
    return application;
  }

  async get(id: string): Promise<AdoptionApplication> {
    const app = await this.applications.findById(id);
    if (!app) throw new NotFoundError(`Application ${id} not found`);
    return app;
  }

  list(): Promise<AdoptionApplication[]> {
    return this.applications.findAll();
  }

  async approve(id: string, actor: string): Promise<AdoptionApplication> {
    const app = await this.get(id);
    const animal = await this.animals.findById(app.animalId);
    if (!animal) throw new NotFoundError(`Animal ${app.animalId} not found`);
    const at = this.clock.now().toISOString();

    const approved = decide(app, "approved", at);
    const adopted = markAdopted(animal);
    const placement = await this.placements.findActiveByAnimalId(adopted.id);
    const others = (await this.applications.findByAnimalId(animal.id)).filter(
      (a) => a.id !== app.id && a.status === "open",
    );
    const rejections = others.map((other) => decide(other, "rejected", at));

    // The adoption, the ended placement and the rejections are stored together with their audit records.
    await this.changes.commit(
      [
        { entityType: "application", entity: approved },
        { entityType: "animal", entity: adopted },
        ...(placement ? [{ entityType: "placement" as const, entity: endPlacement(placement, at) }] : []),
        ...rejections.map((entity) => ({ entityType: "application" as const, entity })),
      ],
      actor,
    );

    await this.notify(approved, adopted.name, actor);
    if (placement) await this.notifyCarer(placement.carerId, adopted.name, actor);
    for (const rejected of rejections) await this.notify(rejected, adopted.name, actor);
    return approved;
  }

  async reject(id: string, actor: string): Promise<AdoptionApplication> {
    const app = await this.get(id);
    const animal = await this.animals.findById(app.animalId);
    const rejected = decide(app, "rejected", this.clock.now().toISOString());
    await this.changes.commit([{ entityType: "application", entity: rejected }], actor);
    await this.notify(rejected, animal?.name ?? "the animal", actor);
    return rejected;
  }

  private async notifyCarer(carerId: string, animalName: string, actor: string): Promise<void> {
    const carer = await this.carers.findById(carerId);
    if (!carer) return;
    await this.notifications.notify(
      carer,
      `${animalName} has been adopted`,
      `Dear ${carer.name}, ${animalName} has been adopted and the foster placement has ended. Thank you for caring for ${animalName}.`,
      actor,
    );
  }

  private async notify(app: AdoptionApplication, animalName: string, actor: string): Promise<void> {
    const approved = app.status === "approved";
    await this.notifications.notify(
      app.applicant,
      `Your adoption application for ${animalName} was ${app.status}`,
      approved
        ? `Dear ${app.applicant.name}, your application to adopt ${animalName} has been approved. We will contact you shortly.`
        : `Dear ${app.applicant.name}, we are sorry to tell you that your application to adopt ${animalName} was not successful.`,
      actor,
    );
  }
}
