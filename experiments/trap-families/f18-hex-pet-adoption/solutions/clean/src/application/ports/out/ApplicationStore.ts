import type { AdoptionApplication } from '../../../domain/model/AdoptionApplication';

export interface ApplicationStore {
  nextId(): string;
  save(application: AdoptionApplication): void;
  byId(id: string): AdoptionApplication | undefined;
  /** Every application for one pet, in id order. */
  forPet(petId: string): AdoptionApplication[];
  /** Applications still waiting for a decision, in id order. */
  pending(): AdoptionApplication[];
}
