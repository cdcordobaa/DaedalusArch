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
