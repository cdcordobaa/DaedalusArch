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
