export class Category {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly color: string
  ) {}

  isValid(): boolean {
    return this.name.length > 0;
  }
}
