import type { Animal } from "../domain/animal.js";
import type { AdoptionApplication } from "../domain/adoption-application.js";
import type { AuditEntityType, AuditEntry } from "../domain/audit.js";
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
}

export interface CarerRepository {
  save(carer: FosterCarer): Promise<void>;
  findById(id: string): Promise<FosterCarer | undefined>;
  findAll(): Promise<FosterCarer[]>;
}

export interface PlacementRepository {
  save(placement: Placement): Promise<void>;
  findById(id: string): Promise<Placement | undefined>;
  findActiveByAnimalId(animalId: string): Promise<Placement | undefined>;
  findByCarerId(carerId: string): Promise<Placement[]>;
}

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

export interface MailSender {
  send(message: EmailMessage): Promise<void>;
}

export interface SmsMessage {
  readonly to: string;
  /** At most 160 characters. */
  readonly text: string;
}

export interface SmsSender {
  /** Submits the message; delivery is reported later via webhook. Returns the provider's message id. */
  send(message: SmsMessage): Promise<{ messageId: string }>;
}

export interface NotificationRepository {
  save(notification: Notification): Promise<void>;
  findById(id: string): Promise<Notification | undefined>;
  findByProviderMessageId(messageId: string): Promise<Notification | undefined>;
  findAll(): Promise<Notification[]>;
}

export interface AuditedChange {
  readonly entityType: AuditEntityType;
  readonly entity: { readonly id: string };
  readonly animalId?: string;
}

/** Saves entities and their audit entries as one atomic unit: all of them or none. */
export interface AuditedStore {
  commit(actor: string, at: Date, changes: AuditedChange[]): Promise<void>;
}

export interface AuditLog {
  findByAnimal(animalId: string): Promise<AuditEntry[]>;
  findByActor(actor: string, fromMs?: number, toMs?: number): Promise<AuditEntry[]>;
}

export interface IdGenerator {
  next(): string;
}

export interface Clock {
  now(): Date;
}
