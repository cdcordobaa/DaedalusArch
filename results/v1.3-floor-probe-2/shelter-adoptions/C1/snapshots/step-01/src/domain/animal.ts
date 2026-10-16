import { InvalidOperation } from './errors';

export type AnimalStatus = 'in-shelter' | 'ready-for-adoption' | 'adopted';

export class Animal {
  constructor(
    readonly id: string,
    readonly species: string,
    readonly name: string,
    readonly estimatedAge: number,
    readonly intakeDate: string,
    public medicalNotes: string,
    public status: AnimalStatus = 'in-shelter',
  ) {}

  markReady(): void {
    if (this.status === 'adopted') throw new InvalidOperation('animal is already adopted');
    this.status = 'ready-for-adoption';
  }

  adopt(): void {
    if (this.status !== 'ready-for-adoption') throw new InvalidOperation('animal is not ready for adoption');
    this.status = 'adopted';
  }
}
