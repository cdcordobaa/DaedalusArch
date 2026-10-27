export class Mutex {
  private held = false;

  runExclusive<T>(work: () => T): T {
    if (this.held) {
      throw new Error("write in progress");
    }
    this.held = true;
    try {
      return work();
    } finally {
      this.held = false;
    }
  }
}
