export class Area {
  private constructor(readonly hectares: number) {}

  static ofHectares(hectares: number): Area {
    if (!(hectares > 0)) {
      throw new Error('area must be positive');
    }
    return new Area(hectares);
  }
}
