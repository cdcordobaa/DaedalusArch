/** How a client wants one of its terms translated. */
export interface GlossaryEntry {
  readonly clientId: string;
  readonly term: string;
  readonly lang: string;
  readonly rendering: string;
}
