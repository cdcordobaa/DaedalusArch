import type { SubmitReadingCommand, SubmitReadingPort } from "../../../application/ports/in/submit-reading.port";
import { toHttp } from "./http-errors";
import type { HttpResponse } from "./http-errors";

export class ReadingController {
  constructor(private readonly submitReading: SubmitReadingPort) {}

  async post(body: unknown): Promise<HttpResponse> {
    const command = parseBody(body);
    if (!command) {
      return { status: 400, body: { error: "BAD_REQUEST" } };
    }
    try {
      await this.submitReading.execute(command);
      return { status: 202, body: { accepted: true } };
    } catch (error) {
      return toHttp(error);
    }
  }
}

function parseBody(body: unknown): SubmitReadingCommand | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const { meterId, kwh, takenAt } = body as Record<string, unknown>;
  if (typeof meterId !== "string" || typeof kwh !== "number" || typeof takenAt !== "string") {
    return undefined;
  }
  if (meterId.trim() === "" || !Number.isFinite(kwh)) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(takenAt)) {
    return undefined;
  }
  return { meterId: meterId.trim(), kwh, takenAt };
}
