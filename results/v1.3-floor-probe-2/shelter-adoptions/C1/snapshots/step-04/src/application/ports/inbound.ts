import { Animal } from '../../domain/animal';
import { AdoptionApplication, Contact, Household } from '../../domain/adoption-application';

export interface NewAnimal { species: string; name: string; estimatedAge: number; intakeDate: string; medicalNotes?: string }

export interface AnimalManagement {
  register(input: NewAnimal, staffId: string): Animal;
  markReady(animalId: string, staffId: string): Animal;
  list(): Animal[];
  get(animalId: string): Animal;
}

export interface Adoptions {
  apply(animalId: string, applicant: Contact, household: Household, actor: string): AdoptionApplication;
  approve(applicationId: string, staffId: string): AdoptionApplication;
  reject(applicationId: string, staffId: string): AdoptionApplication;
  forAnimal(animalId: string): AdoptionApplication[];
}

export interface NewCarer { name: string; email: string; phone?: string; notifyBy?: 'email' | 'sms'; capacity: number; species: string[] }

export interface Fostering {
  signUp(input: NewCarer): import('../../domain/foster').FosterCarer;
  carers(): import('../../domain/foster').FosterCarer[];
  place(animalId: string, carerId: string, staffId: string): import('../../domain/foster').FosterPlacement;
  endPlacement(placementId: string, staffId: string): import('../../domain/foster').FosterPlacement;
}

export interface NotificationStatus {
  deliveryReport(providerMessageId: string, status: 'delivered' | 'failed'): Promise<void>;
  list(): import('../../domain/notification').Notification[];
}

export interface AuditTrail {
  ofAnimal(animalId: string): import('../../domain/audit-entry').AuditEntry[];
  byStaff(staffId: string, from: string, to: string): import('../../domain/audit-entry').AuditEntry[];
}
