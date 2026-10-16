export type ApplicationStatus = 'open' | 'approved' | 'rejected';

export interface Applicant {
  preferredChannel?: 'email' | 'sms';
  name: string;
  email: string;
  phone?: string;
  household: string;
}

export interface AdoptionApplication {
  id: string;
  animalId: string;
  applicant: Applicant;
  status: ApplicationStatus;
  submittedAt: string;
  decidedAt?: string;
}

export function decide(app: AdoptionApplication, status: 'approved' | 'rejected', at: string): AdoptionApplication {
  if (app.status !== 'open') throw new Error(`Application ${app.id} is already ${app.status}`);
  return { ...app, status, decidedAt: at };
}
