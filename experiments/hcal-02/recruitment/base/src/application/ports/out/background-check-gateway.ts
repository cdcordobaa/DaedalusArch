export interface BackgroundCheckGateway {
  isClear(candidateName: string, email: string): Promise<boolean>;
}
