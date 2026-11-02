export interface LetterView {
  readonly mandateId: string;
  readonly line: string;
}

export interface PlanLetter {
  letter(mandateId: string): Promise<LetterView>;
}
