import { DomainError } from './animal';

export type ApplicationStatus = 'open' | 'approved' | 'rejected';

export interface AdoptionApplication {
  id: string;
  animalId: string;
  applicantName: string;
  email: string;
  phone?: string;
  household: { adults: number; children: number; otherPets: string; homeType: string };
  status: ApplicationStatus;
  submittedAt: string;
  decidedAt?: string;
}

export function decide(app: AdoptionApplication, status: 'approved' | 'rejected', at: string): AdoptionApplication {
  if (app.status !== 'open') throw new DomainError(`application ${app.id} already ${app.status}`);
  return { ...app, status, decidedAt: at };
}
