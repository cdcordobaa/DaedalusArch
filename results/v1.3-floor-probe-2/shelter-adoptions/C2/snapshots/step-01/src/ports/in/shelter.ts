import { Animal } from '../../domain/animal';
import { AdoptionApplication } from '../../domain/application';

export interface RegisterAnimalInput {
  species: string;
  name: string;
  estimatedAgeYears: number;
  intakeDate: string;
  medicalNotes?: string;
}

export interface SubmitApplicationInput {
  animalId: string;
  applicantName: string;
  email: string;
  phone?: string;
  household: AdoptionApplication['household'];
}

export interface ShelterUseCases {
  registerAnimal(input: RegisterAnimalInput): Animal;
  markReady(animalId: string): Animal;
  listAnimals(): Animal[];
  submitApplication(input: SubmitApplicationInput): AdoptionApplication;
  approve(applicationId: string): AdoptionApplication;
  reject(applicationId: string): AdoptionApplication;
  applicationsFor(animalId: string): AdoptionApplication[];
}
