import { RegistrationService } from './scheduling/application/RegistrationService';
import { InMemoryPatientRepository } from './scheduling/infrastructure/InMemoryPatientRepository';

export const registration = new RegistrationService(new InMemoryPatientRepository());
