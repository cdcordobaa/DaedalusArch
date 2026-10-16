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

export interface CarerRepository {
  put(c: import('../model').Carer): void;
  get(id: string): import('../model').Carer | undefined;
  all(): import('../model').Carer[];
}

export interface PlacementRepository {
  put(p: import('../model').Placement): void;
  get(id: string): import('../model').Placement | undefined;
  current(): import('../model').Placement[];
}

export interface NotificationRepository {
  put(n: import('../model').SentNotification): void;
  bySmsId(smsId: string): import('../model').SentNotification | undefined;
  all(): import('../model').SentNotification[];
}
