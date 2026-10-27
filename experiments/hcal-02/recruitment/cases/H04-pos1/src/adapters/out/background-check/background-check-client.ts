import { BackgroundCheckGateway } from "../../../application/ports/out/background-check-gateway";
import type { CheckrReport } from "checkr-sdk";

export type Transport = (path: string, payload: string) => Promise<string>;

export class BackgroundCheckClient implements BackgroundCheckGateway {
  constructor(private readonly transport: Transport) {}

  async isClear(candidateName: string, email: string): Promise<boolean> {
    const raw = await this.transport("/checks", JSON.stringify({ name: candidateName, email }));
    const parsed = JSON.parse(raw) as { status?: string };
    return parsed.status === "clear";
  }

  async fetchReport(candidateId: string): Promise<CheckrReport> {
    const raw = await this.transport(`/reports/${candidateId}`, "");
    return JSON.parse(raw) as CheckrReport;
  }
}
