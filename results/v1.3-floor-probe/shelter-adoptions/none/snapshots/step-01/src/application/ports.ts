import { Animal } from '../domain/animal';
import { AdoptionApplication } from '../domain/adoption-application';

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
