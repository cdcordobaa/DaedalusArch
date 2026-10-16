import { Animal } from '../../domain/animal';
import { AdoptionApplication } from '../../domain/adoption-application';

export interface AnimalStore { save(a: Animal): void; find(id: string): Animal | undefined; all(): Animal[] }
export interface ApplicationStore {
  save(a: AdoptionApplication): void;
  find(id: string): AdoptionApplication | undefined;
  forAnimal(animalId: string): AdoptionApplication[];
}
export interface EmailSender { send(to: string, subject: string, text: string): void }
export interface Clock { nowIso(): string }
export interface IdFactory { newId(): string }

export interface CarerStore { save(c: import('../../domain/foster').FosterCarer): void; find(id: string): import('../../domain/foster').FosterCarer | undefined; all(): import('../../domain/foster').FosterCarer[] }
export interface PlacementStore {
  save(p: import('../../domain/foster').FosterPlacement): void;
  find(id: string): import('../../domain/foster').FosterPlacement | undefined;
  activeFor(filter: { animalId?: string; carerId?: string }): import('../../domain/foster').FosterPlacement[];
}

export interface SmsSender {
  /** TextBridge: number + at most 160 characters; returns its message id, delivery is reported later. */
  send(phone: string, text: string): Promise<string>;
}
export interface NotificationStore {
  save(n: import('../../domain/notification').Notification): void;
  byProviderId(id: string): import('../../domain/notification').Notification | undefined;
  all(): import('../../domain/notification').Notification[];
}

export interface AuditStore {
  add(e: import('../../domain/audit-entry').AuditEntry): void;
  byAnimal(animalId: string): import('../../domain/audit-entry').AuditEntry[];
  byStaff(staffId: string, from: string, to: string): import('../../domain/audit-entry').AuditEntry[];
}
/** All saves inside the callback, the audit entries included, are committed together or rolled back together. */
export interface TransactionRunner { inTransaction<T>(fn: () => T): T }
