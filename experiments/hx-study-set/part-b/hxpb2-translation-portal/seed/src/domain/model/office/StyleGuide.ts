/** A client's house style: tone and words the translators must avoid. */
export interface StyleGuide {
  readonly clientId: string;
  readonly formal: boolean;
  readonly avoid: readonly string[];
}
