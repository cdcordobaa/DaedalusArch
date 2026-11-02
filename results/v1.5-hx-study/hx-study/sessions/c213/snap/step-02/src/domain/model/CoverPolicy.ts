/** The cover the insurer issued for a hire's quote: in force, waiting for paperwork, or void. */
export interface CoverPolicy {
  readonly reference: string;
  readonly standing: 'active' | 'awaiting_paperwork' | 'void';
  /** The paperwork the insurer still wants; empty unless awaiting_paperwork. */
  readonly outstandingPaperwork: readonly string[];
}
