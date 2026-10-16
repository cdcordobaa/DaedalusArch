import { markAdopted, markReady, registerAnimal } from "../domain/animal.js";
import type { Animal, NewAnimal } from "../domain/animal.js";
import { decide, submitApplication } from "../domain/adoption-application.js";
import type { AdoptionApplication } from "../domain/adoption-application.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { endPlacement, registerCarer, startPlacement } from "../domain/foster.js";
import type { FosterCarer, Placement } from "../domain/foster.js";
import type {
  AnimalRepository,
  ApplicationRepository,
  AuditedChange,
  AuditedStore,
  AuditLog,
  CarerRepository,
  PlacementRepository,
  Clock,
  IdGenerator,
  MailSender,
  NotificationRepository,
  SmsSender,
} from "./ports.js";
import { applyDeliveryReport, parseDeliveryReport, smsText } from "../domain/notification.js";
import type { Notification, NotificationChannel } from "../domain/notification.js";
import { SYSTEM_ACTOR, parseDateBound } from "../domain/audit.js";
import type { AuditEntry } from "../domain/audit.js";

interface Recipient {
  readonly name: string;
  readonly email: string;
  readonly phone?: string;
  readonly channel: NotificationChannel;
}

export class ShelterService {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly applications: ApplicationRepository,
    private readonly mail: MailSender,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly carers: CarerRepository,
    private readonly placements: PlacementRepository,
    private readonly sms: SmsSender,
    private readonly notifications: NotificationRepository,
    private readonly store: AuditedStore,
    private readonly auditLog: AuditLog,
  ) {}

  private notificationLock: Promise<unknown> = Promise.resolve();

  private lockedNotifications<T>(task: () => Promise<T>): Promise<T> {
    const run = this.notificationLock.then(task, task);
    this.notificationLock = run.catch(() => undefined);
    return run;
  }

  /** Saves the changes and their audit entries atomically. */
  private commit(actor: string, changes: AuditedChange[]): Promise<void> {
    return this.store.commit(actor, this.clock.now(), changes);
  }

  private saveNotification(actor: string, n: Notification): Promise<void> {
    return this.commit(actor, [{ entityType: "notification", entity: n }]);
  }

  private saveAnimal(actor: string, a: Animal): Promise<void> {
    return this.commit(actor, [{ entityType: "animal", entity: a, animalId: a.id }]);
  }

  private savePlacement(actor: string, p: Placement): Promise<void> {
    return this.commit(actor, [{ entityType: "placement", entity: p, animalId: p.animalId }]);
  }

  private static applicationChange(a: AdoptionApplication): AuditedChange {
    return { entityType: "application", entity: a, animalId: a.animalId };
  }

  async listAnimalAudit(animalId: string): Promise<AuditEntry[]> {
    await this.requireAnimal(animalId);
    return this.auditLog.findByAnimal(animalId);
  }

  listStaffAudit(staffId: string, from: unknown, to: unknown): Promise<AuditEntry[]> {
    const fromMs = parseDateBound(from, "from");
    const toMs = parseDateBound(to, "to");
    return this.auditLog.findByActor(staffId, fromMs, toMs);
  }

  listNotifications(): Promise<Notification[]> {
    return this.notifications.findAll();
  }

  async getNotification(id: string): Promise<Notification> {
    const n = await this.notifications.findById(id);
    if (!n) throw new NotFoundError(`notification ${id} not found`);
    return n;
  }

  /** Handles a TextBridge delivery report; a failed SMS is re-sent by e-mail. */
  handleDeliveryReport(input: unknown): Promise<Notification> {
    const report = parseDeliveryReport(input);
    const actor = SYSTEM_ACTOR;
    return this.lockedNotifications(async () => {
      const n = await this.notifications.findByProviderMessageId(report.messageId);
      if (!n) throw new NotFoundError(`message ${report.messageId} not found`);
      if (n.status === "failed" || n.status === "delivered") return n;
      const updated = applyDeliveryReport(n, report.status, report.reason, this.clock.now());
      await this.saveNotification(actor, updated);
      if (updated.status === "failed") return this.fallbackToEmail(actor, updated);
      return updated;
    });
  }

  private async fallbackToEmail(actor: string, failed: Notification): Promise<Notification> {
    if (failed.fallbackEmail === undefined || failed.fallbackId !== undefined) return failed;
    const email = await this.sendEmail(
      actor,
      failed.recipientName,
      failed.fallbackEmail,
      failed.subject,
      failed.body,
      failed.id,
    );
    const linked = { ...failed, fallbackId: email.id };
    await this.saveNotification(actor, linked);
    return linked;
  }

  private async sendEmail(
    actor: string,
    recipientName: string,
    to: string,
    subject: string,
    body: string,
    fallbackForId?: string,
  ): Promise<Notification> {
    const now = this.clock.now().toISOString();
    const base: Notification = {
      id: this.ids.next(),
      channel: "email",
      recipientName,
      to,
      subject,
      body,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    const pending = fallbackForId === undefined ? base : { ...base, fallbackForId };
    await this.saveNotification(actor, pending);
    try {
      await this.mail.send({ to, subject, body });
    } catch (err) {
      await this.saveNotification(actor, {
        ...pending,
        status: "failed",
        failureReason: err instanceof Error ? err.message : "e-mail could not be sent",
      });
      throw err;
    }
    const sent: Notification = { ...pending, status: "sent", updatedAt: this.clock.now().toISOString() };
    await this.saveNotification(actor, sent);
    return sent;
  }

  private async sendSms(
    actor: string,
    r: Recipient,
    phone: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const now = this.clock.now().toISOString();
    const pending: Notification = {
      id: this.ids.next(),
      channel: "sms",
      recipientName: r.name,
      to: phone,
      subject,
      body: smsText(subject, body),
      status: "pending",
      createdAt: now,
      updatedAt: now,
      fallbackEmail: r.email,
    };
    await this.saveNotification(actor, pending);
    let messageId: string;
    try {
      ({ messageId } = await this.sms.send({ to: phone, text: pending.body }));
    } catch (err) {
      const failed: Notification = {
        ...pending,
        status: "failed",
        updatedAt: this.clock.now().toISOString(),
        failureReason: err instanceof Error ? err.message : "SMS could not be sent",
      };
      await this.saveNotification(actor, failed);
      await this.fallbackToEmail(actor, failed);
      return;
    }
    await this.saveNotification(actor, {
      ...pending,
      status: "sent",
      providerMessageId: messageId,
      updatedAt: this.clock.now().toISOString(),
    });
  }

  private dispatch(actor: string, r: Recipient, subject: string, body: string): Promise<void> {
    return this.lockedNotifications(async () => {
      if (r.channel === "sms" && r.phone !== undefined) {
        await this.sendSms(actor, r, r.phone, subject, body);
      } else {
        await this.sendEmail(actor, r.name, r.email, subject, body);
      }
    });
  }

  private placementLock: Promise<unknown> = Promise.resolve();

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = this.placementLock.then(task, task);
    this.placementLock = run.catch(() => undefined);
    return run;
  }

  async registerCarer(input: unknown): Promise<FosterCarer> {
    const carer = registerCarer(this.ids.next(), input);
    await this.carers.save(carer);
    return carer;
  }

  listCarers(): Promise<FosterCarer[]> {
    return this.carers.findAll();
  }

  getCarer(id: string): Promise<FosterCarer> {
    return this.requireCarer(id);
  }

  async listPlacementsForCarer(carerId: string): Promise<Placement[]> {
    await this.requireCarer(carerId);
    return this.placements.findByCarerId(carerId);
  }

  async getActivePlacementForAnimal(animalId: string): Promise<Placement> {
    await this.requireAnimal(animalId);
    const placement = await this.placements.findActiveByAnimalId(animalId);
    if (!placement) throw new NotFoundError(`animal ${animalId} is not in foster care`);
    return placement;
  }

  getPlacement(id: string): Promise<Placement> {
    return this.requirePlacement(id);
  }

  placeAnimal(actor: string, animalId: string, carerId: unknown): Promise<Placement> {
    return this.serialized(async () => {
      if (typeof carerId !== "string" || carerId.trim() === "") {
        throw new ValidationError("carerId is required");
      }
      const animal = await this.requireAnimal(animalId);
      const carer = await this.requireCarer(carerId);
      if (animal.status === "adopted") {
        throw new ConflictError("animal is already adopted");
      }
      if (await this.placements.findActiveByAnimalId(animalId)) {
        throw new ConflictError("animal is already in foster care");
      }
      const active = (await this.placements.findByCarerId(carer.id)).filter(
        (p) => p.endedAt === undefined,
      ).length;
      const placement = startPlacement(
        this.ids.next(),
        carer,
        animal.id,
        animal.species,
        active,
        this.clock.now(),
      );
      await this.savePlacement(actor, placement);
      return placement;
    });
  }

  endPlacementById(actor: string, placementId: string): Promise<Placement> {
    return this.serialized(async () => {
      const placement = await this.requirePlacement(placementId);
      const ended = endPlacement(placement, this.clock.now());
      await this.savePlacement(actor, ended);
      return ended;
    });
  }

  async registerAnimal(actor: string, input: NewAnimal): Promise<Animal> {
    const animal = registerAnimal(this.ids.next(), input);
    await this.saveAnimal(actor, animal);
    return animal;
  }

  listAnimals(): Promise<Animal[]> {
    return this.animals.findAll();
  }

  getAnimal(id: string): Promise<Animal> {
    return this.requireAnimal(id);
  }

  async markReadyForAdoption(actor: string, id: string): Promise<Animal> {
    const updated = markReady(await this.requireAnimal(id));
    await this.saveAnimal(actor, updated);
    return updated;
  }

  async submitApplication(
    actor: string,
    animalId: string,
    applicant: unknown,
    household: unknown,
  ): Promise<AdoptionApplication> {
    const animal = await this.requireAnimal(animalId);
    if (animal.status !== "ready") {
      throw new ConflictError("animal is not available for adoption");
    }
    const application = submitApplication(
      this.ids.next(),
      animalId,
      applicant,
      household,
      this.clock.now(),
    );
    await this.commit(actor, [ShelterService.applicationChange(application)]);
    return application;
  }

  getApplication(id: string): Promise<AdoptionApplication> {
    return this.requireApplication(id);
  }

  listApplicationsForAnimal(animalId: string): Promise<AdoptionApplication[]> {
    return this.applications.findByAnimalId(animalId);
  }

  async approve(actor: string, applicationId: string): Promise<AdoptionApplication> {
    const application = await this.requireApplication(applicationId);
    const animal = await this.requireAnimal(application.animalId);
    const now = this.clock.now();
    const approved = decide(application, "approved", now);
    const adopted = markAdopted(animal);

    const others = (await this.applications.findByAnimalId(animal.id)).filter(
      (a) => a.id !== approved.id && a.status === "open",
    );
    const rejectedOthers = others.map((other) => decide(other, "rejected", now));

    await this.commit(actor, [
      ShelterService.applicationChange(approved),
      { entityType: "animal", entity: adopted, animalId: adopted.id },
      ...rejectedOthers.map((r) => ShelterService.applicationChange(r)),
    ]);

    await this.endFosterOnAdoption(actor, animal);

    await this.notify(actor, approved, animal);
    for (const rejected of rejectedOthers) {
      await this.notify(actor, rejected, animal);
    }
    return approved;
  }

  async reject(actor: string, applicationId: string): Promise<AdoptionApplication> {
    const application = await this.requireApplication(applicationId);
    const animal = await this.requireAnimal(application.animalId);
    const rejected = decide(application, "rejected", this.clock.now());
    await this.commit(actor, [ShelterService.applicationChange(rejected)]);
    await this.notify(actor, rejected, animal);
    return rejected;
  }

  private async endFosterOnAdoption(actor: string, animal: Animal): Promise<void> {
    const ended = await this.serialized(async () => {
      const active = await this.placements.findActiveByAnimalId(animal.id);
      if (!active) return undefined;
      const done = endPlacement(active, this.clock.now());
      await this.savePlacement(actor, done);
      return done;
    });
    if (!ended) return;
    const carer = await this.carers.findById(ended.carerId);
    if (!carer) return;
    await this.dispatch(
      actor,
      {
        name: carer.name,
        email: carer.email,
        channel: carer.notificationChannel,
        ...(carer.phone === undefined ? {} : { phone: carer.phone }),
      },
      `${animal.name} has been adopted`,
      `Hello ${carer.name}, ${animal.name} has been adopted, so the foster placement with you has ended. Thank you for caring for them!`,
    );
  }

  private async requireCarer(id: string): Promise<FosterCarer> {
    const carer = await this.carers.findById(id);
    if (!carer) throw new NotFoundError(`carer ${id} not found`);
    return carer;
  }

  private async requirePlacement(id: string): Promise<Placement> {
    const placement = await this.placements.findById(id);
    if (!placement) throw new NotFoundError(`placement ${id} not found`);
    return placement;
  }

  private async notify(
    actor: string,
    application: AdoptionApplication,
    animal: Animal,
  ): Promise<void> {
    const approved = application.status === "approved";
    const a = application.applicant;
    await this.dispatch(
      actor,
      { name: a.name, email: a.email, phone: a.phone, channel: a.notificationChannel },
      `Your adoption application for ${animal.name} was ${application.status}`,
      approved
        ? `Hello ${a.name}, congratulations! Your application to adopt ${animal.name} has been approved.`
        : `Hello ${a.name}, we are sorry to tell you that your application to adopt ${animal.name} was not successful.`,
    );
  }

  private async requireAnimal(id: string): Promise<Animal> {
    const animal = await this.animals.findById(id);
    if (!animal) throw new NotFoundError(`animal ${id} not found`);
    return animal;
  }

  private async requireApplication(id: string): Promise<AdoptionApplication> {
    const application = await this.applications.findById(id);
    if (!application) throw new NotFoundError(`application ${id} not found`);
    return application;
  }
}
