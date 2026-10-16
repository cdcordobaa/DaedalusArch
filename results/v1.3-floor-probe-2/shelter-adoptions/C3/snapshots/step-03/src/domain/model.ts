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

export interface Applicant { name: string; email: string; phone?: string; channel?: 'email' | 'sms' }
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

export interface Carer {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone?: string;
  readonly channel?: 'email' | 'sms';
  readonly capacity: number;
  readonly species: readonly string[];
}

export interface Placement {
  readonly id: string;
  readonly animalId: string;
  readonly carerId: string;
  readonly from: string;
  readonly until?: string;
}

export const Carers = {
  assertRoomFor(c: Carer, species: string, hosting: number): void {
    if (!c.species.includes(species)) throw new ShelterError(`${c.name} does not foster ${species}`);
    if (hosting >= c.capacity) throw new ShelterError(`${c.name} already hosts ${hosting} of ${c.capacity}`);
  },
};

export type Channel = 'email' | 'sms';
export type DeliveryState = 'sent' | 'delivered' | 'failed' | 'emailed-after-sms-failure';

export interface Contactable { name: string; email: string; phone?: string; channel?: Channel }

export interface SentNotification {
  readonly id: string;
  readonly to: Contactable;
  readonly channel: Channel;
  readonly subject: string;
  readonly body: string;
  readonly state: DeliveryState;
  readonly smsId?: string;
  readonly updatedAt: string;
}

export const SMS_LIMIT = 160;

export function toSms(subject: string, body: string): string {
  const text = `${subject}. ${body.replace(/\s+/g, ' ')}`;
  return text.length <= SMS_LIMIT ? text : `${text.slice(0, SMS_LIMIT - 3)}...`;
}
