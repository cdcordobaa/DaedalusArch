export class ShelterError extends Error {
  constructor(message: string, readonly kind: 'not-found' | 'conflict' | 'invalid' = 'conflict') { super(message); }
}

export type AnimalState = 'registered' | 'ready' | 'adopted';

export interface Animal {
  readonly id: string;
  readonly species: string;
  readonly name: string;
  readonly estimatedAge: number;
  readonly intakeDate: string;
  readonly medicalNotes: string;
  readonly state: AnimalState;
}

export interface Applicant { name: string; email: string; phone?: string }
export interface HouseholdInfo { adults: number; children: number; pets: string; home: string }

export type ApplicationState = 'open' | 'approved' | 'rejected';

export interface Application {
  readonly id: string;
  readonly animalId: string;
  readonly applicant: Applicant;
  readonly household: HouseholdInfo;
  readonly state: ApplicationState;
  readonly submittedAt: string;
  readonly decidedAt?: string;
}

export const Animals = {
  ready(a: Animal): Animal {
    if (a.state === 'adopted') throw new ShelterError('animal already adopted');
    return { ...a, state: 'ready' };
  },
  adopted(a: Animal): Animal {
    if (a.state !== 'ready') throw new ShelterError('animal is not ready for adoption');
    return { ...a, state: 'adopted' };
  },
};

export const Applications = {
  decide(app: Application, state: 'approved' | 'rejected', at: string): Application {
    if (app.state !== 'open') throw new ShelterError(`application is already ${app.state}`);
    return { ...app, state, decidedAt: at };
  },
};
