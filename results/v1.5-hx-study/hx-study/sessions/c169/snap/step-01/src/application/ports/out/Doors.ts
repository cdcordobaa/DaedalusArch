/** Pops a locker door open. Satisfied by the LockBank driver. */
export interface Doors {
  pulse(command: { hub: string; bay: number; holdMs: number }): { readonly result: string };
}
