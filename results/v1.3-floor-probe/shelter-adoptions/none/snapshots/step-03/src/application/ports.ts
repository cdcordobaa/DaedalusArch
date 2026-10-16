import { Animal } from '../domain/animal';
import { AdoptionApplication } from '../domain/adoption-application';
import { FosterCarer, Placement } from '../domain/foster';
import { Notification } from '../domain/notification';

export interface AnimalRepository {
  save(animal: Animal): void;
  findById(id: string): Animal | undefined;
  findAll(): Animal[];
}

export interface ApplicationRepository {
  save(app: AdoptionApplication): void;
  findById(id: string): AdoptionApplication | undefined;
  findByAnimal(animalId: string): AdoptionApplication[];
}

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface Mailer {
  send(message: EmailMessage): void;
}

export interface IdGenerator {
  next(): string;
}

export interface CarerRepository {
  save(carer: FosterCarer): void;
  findById(id: string): FosterCarer | undefined;
  findAll(): FosterCarer[];
}

export interface PlacementRepository {
  save(placement: Placement): void;
  findById(id: string): Placement | undefined;
  findActiveByCarer(carerId: string): Placement[];
  findActiveByAnimal(animalId: string): Placement | undefined;
}

export interface SmsGateway {
  send(phone: string, text: string): Promise<{ messageId: string }>;
}

export interface NotificationRepository {
  save(n: Notification): void;
  findById(id: string): Notification | undefined;
  findByProviderMessageId(messageId: string): Notification | undefined;
  findAll(): Notification[];
}
