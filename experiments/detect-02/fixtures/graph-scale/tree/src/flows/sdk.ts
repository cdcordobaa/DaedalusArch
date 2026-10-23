export function createStep<I>(name: string, fn: (input: I) => Promise<void>): (input: I) => Promise<void> {
  void name;
  return fn;
}
export function createWorkflow<I>(name: string, fn: (input: I) => void): (input: I) => void {
  void name;
  return fn;
}
