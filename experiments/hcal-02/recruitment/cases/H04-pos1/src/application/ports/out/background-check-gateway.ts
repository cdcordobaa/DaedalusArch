import { CheckrReport } from "checkr-sdk";

export interface BackgroundCheckGateway {
  isClear(candidateName: string, email: string): Promise<boolean>;
  fetchReport(candidateId: string): Promise<CheckrReport>;
}
