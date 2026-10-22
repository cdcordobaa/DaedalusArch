/** Aggregate root: a hotel guest. */
export class Guest {
  constructor(readonly id: string, private name: string, readonly email: string) {
    if (name.trim() === '') throw new Error('A guest needs a name');
  }

  rename(name: string): void {
    if (name.trim() === '') throw new Error('A guest needs a name');
    this.name = name;
  }

  displayName(): string {
    return this.name;
  }
}
