/** Input of the quote request, as the client portal sends it. */
export interface RequestQuoteCommand {
  readonly clientId: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly words: number;
  readonly dueAt: string;
  readonly documentUrl: string;
  readonly certified: boolean;
}

export interface ReviewCommand {
  readonly reviewerId: string;
  readonly score: number;
  readonly comments: string;
}
