import type { Animal } from "../domain/animal.js";
import type { AuditEntry } from "../domain/audit.js";
import type { AdoptionApplication } from "../domain/application.js";
import type { Notification } from "../domain/notification.js";
import type { FosterCarer, Placement } from "../domain/foster.js";

export interface AnimalRepository {
  save(animal: Animal): Promise<void>;
  findById(id: string): Promise<Animal | undefined>;
  findAll(): Promise<Animal[]>;
}

export interface ApplicationRepository {
  save(application: AdoptionApplication): Promise<void>;
  findById(id: string): Promise<AdoptionApplication | undefined>;
  findByAnimalId(animalId: string): Promise<AdoptionApplication[]>;
  findAll(): Promise<AdoptionApplication[]>;
}

export interface FosterCarerRepository {
  save(carer: FosterCarer): Promise<void>;
  findById(id: string): Promise<FosterCarer | undefined>;
  findAll(): Promise<FosterCarer[]>;
}

export interface PlacementRepository {
  save(placement: Placement): Promise<void>;
  /** Atomically stores the placement only if the carer has fewer than `capacity` active placements. */
  saveIfWithinCapacity(placement: Placement, capacity: number): Promise<boolean>;
  findById(id: string): Promise<Placement | undefined>;
  findActiveByAnimalId(animalId: string): Promise<Placement | undefined>;
  findByCarerId(carerId: string): Promise<Placement[]>;
  findAll(): Promise<Placement[]>;
}

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface MailPort {
  send(message: MailMessage): Promise<void>;
}

export interface SmsMessage {
  to: string;
  /** At most 160 characters. */
  text: string;
}

export interface SmsPort {
  /** Returns the provider's message id; delivery is reported later through the webhook. */
  send(message: SmsMessage): Promise<{ messageId: string }>;
}

export interface NotificationRepository {
  save(notification: Notification): Promise<void>;
  findById(id: string): Promise<Notification | undefined>;
  findByProviderMessageId(messageId: string): Promise<Notification | undefined>;
  findAll(): Promise<Notification[]>;
}

export type PendingChange =
  | { entityType: "animal"; entity: Animal; capacity?: undefined }
  | { entityType: "application"; entity: AdoptionApplication; capacity?: undefined }
  | { entityType: "placement"; entity: Placement; /** Only store if the carer has fewer active placements. */ capacity?: number }
  | { entityType: "notification"; entity: Notification; capacity?: undefined };

/** Saves entities together with their audit records: all of them are stored, or none. */
export interface ChangeStore {
  commit(changes: PendingChange[], actor: string): Promise<void>;
}

export interface AuditLogReader {
  findByAnimalId(animalId: string): Promise<AuditEntry[]>;
  findByActor(actor: string, from: string, to: string): Promise<AuditEntry[]>;
}

export interface IdGenerator {
  next(): string;
}

export interface Clock {
  now(): Date;
}
