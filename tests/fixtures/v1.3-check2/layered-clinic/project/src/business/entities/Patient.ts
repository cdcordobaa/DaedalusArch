export class Patient {
  id: string;
  fullName: string;
  birthYear: number;
  blocked: boolean;

  constructor(id: string, fullName: string, birthYear: number, blocked: boolean) {
    this.id = id;
    this.fullName = fullName;
    this.birthYear = birthYear;
    this.blocked = blocked;
  }

  isMinor(year: number): boolean {
    return year - this.birthYear < 18;
  }
}
