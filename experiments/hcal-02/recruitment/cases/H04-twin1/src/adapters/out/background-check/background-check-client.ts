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

  async fetchScore(candidateId: string): Promise<number> {
    const report = JSON.parse(await this.transport(`/reports/${candidateId}`, "")) as CheckrReport;
    return report.status === "clear" ? 100 : 0;
  }
}
