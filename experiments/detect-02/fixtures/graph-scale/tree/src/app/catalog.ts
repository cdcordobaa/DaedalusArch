export class Catalog {
  add(item: string): void;
  add(item: number): void;
  add(item: string | number): void { void item; }

  addDefaults(): void {
    this.add('a');
  }
}
