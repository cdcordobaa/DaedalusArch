import { Animal } from '../../domain/animal';
import { AdoptionApplication, Contact, Household } from '../../domain/adoption-application';

export interface NewAnimal { species: string; name: string; estimatedAge: number; intakeDate: string; medicalNotes?: string }

export interface AnimalManagement {
  register(input: NewAnimal): Animal;
  markReady(animalId: string): Animal;
  list(): Animal[];
  get(animalId: string): Animal;
}

export interface Adoptions {
  apply(animalId: string, applicant: Contact, household: Household): AdoptionApplication;
  approve(applicationId: string): AdoptionApplication;
  reject(applicationId: string): AdoptionApplication;
  forAnimal(animalId: string): AdoptionApplication[];
}

export interface NewCarer { name: string; email: string; phone?: string; capacity: number; species: string[] }

export interface Fostering {
  signUp(input: NewCarer): import('../../domain/foster').FosterCarer;
  carers(): import('../../domain/foster').FosterCarer[];
  place(animalId: string, carerId: string): import('../../domain/foster').FosterPlacement;
  endPlacement(placementId: string): import('../../domain/foster').FosterPlacement;
}
