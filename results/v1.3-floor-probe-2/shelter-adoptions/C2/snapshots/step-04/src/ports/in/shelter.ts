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
  notifyBy?: 'email' | 'sms';
  household: AdoptionApplication['household'];
}

export interface ShelterUseCases {
  registerAnimal(input: RegisterAnimalInput, actor: string): Animal;
  markReady(animalId: string, actor: string): Animal;
  listAnimals(): Animal[];
  submitApplication(input: SubmitApplicationInput, actor: string): AdoptionApplication;
  approve(applicationId: string, actor: string): AdoptionApplication;
  reject(applicationId: string, actor: string): AdoptionApplication;
  applicationsFor(animalId: string): AdoptionApplication[];
}
