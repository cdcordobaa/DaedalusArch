/** What campaigns need to know about the people who pledge. */
export interface BackerLookup {
  isRegistered(backerId: string): boolean;
  /** The backer's standing as their profile shows it, or undefined for an unknown backer. */
  standingOf(backerId: string): string | undefined;
}
