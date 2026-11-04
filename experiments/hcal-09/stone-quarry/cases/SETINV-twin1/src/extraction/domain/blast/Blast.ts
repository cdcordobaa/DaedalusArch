export class Blast {
  private constructor(
    readonly id: string,
    readonly benchId: string,
    private tonnes: number,
    readonly month: string,
  ) {}

  static plan(id: string, benchId: string, tonnes: number, month: string): Blast {
    if (!(tonnes > 0)) throw new Error(`blast ${id}: planned tonnes must be positive`);
    return new Blast(id, benchId, tonnes, month);
  }

  replan(tonnes: number): void {
    if (!(tonnes > 0)) throw new Error(`blast ${this.id}: planned tonnes must be positive`);
    this.tonnes = tonnes;
  }

  get plannedTonnes(): number {
    return this.tonnes;
  }
}
