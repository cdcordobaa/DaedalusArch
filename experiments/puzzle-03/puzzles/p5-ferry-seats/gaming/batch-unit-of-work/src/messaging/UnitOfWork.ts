/** Runs a batch of changes as one unit: if one fails, the ones after it are not run. */
export class UnitOfWork {
  run(changes: readonly (() => void)[]): void {
    for (const change of changes) change();
  }
}
