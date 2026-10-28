export class VaccinationRecord {
  constructor(
    readonly petId: string,
    readonly vaccine: string,
    readonly administeredOn: Date,
    readonly nextDueOn: Date,
  ) {}

  isDue(now: Date): boolean {
    return this.nextDueOn.getTime() <= now.getTime();
  }
}
