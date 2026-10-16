export class Member {
  id: string;
  name: string;
  maxLoans: number;
  active: boolean;

  constructor(id: string, name: string, maxLoans: number, active: boolean) {
    this.id = id;
    this.name = name;
    this.maxLoans = maxLoans;
    this.active = active;
  }

  canBorrow(openLoans: number): boolean {
    return this.active && openLoans < this.maxLoans;
  }
}
