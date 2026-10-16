export class Practitioner {
  id: string;
  fullName: string;
  specialty: string;
  dailyCapacity: number;

  constructor(id: string, fullName: string, specialty: string, dailyCapacity: number) {
    this.id = id;
    this.fullName = fullName;
    this.specialty = specialty;
    this.dailyCapacity = dailyCapacity;
  }

  treatsMinors(): boolean {
    return this.specialty === 'paediatrics' || this.specialty === 'general';
  }
}
