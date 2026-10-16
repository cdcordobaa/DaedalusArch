import { Animal, Application } from '../model';

export interface AnimalRepository {
  put(a: Animal): void;
  get(id: string): Animal | undefined;
  all(): Animal[];
}

export interface ApplicationRepository {
  put(a: Application): void;
  get(id: string): Application | undefined;
  ofAnimal(animalId: string): Application[];
}
