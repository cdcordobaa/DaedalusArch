export class CatalogCache {
  private names: string[] = [];
  private lock: Promise<void> = Promise.resolve();

  constructor(private readonly load: () => Promise<string[]>) {}

  refresh(): Promise<void> {
    const run = this.lock.then(async () => {
      this.names = await this.load();
    });
    this.lock = run.catch(() => undefined);
    return run;
  }

  list(): string[] {
    return [...this.names];
  }
}
