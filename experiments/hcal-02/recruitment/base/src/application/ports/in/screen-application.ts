export interface ScreeningResult {
  readonly score: number;
  readonly passed: boolean;
}

export interface ScreenApplication {
  execute(applicationId: string): Promise<ScreeningResult>;
}
