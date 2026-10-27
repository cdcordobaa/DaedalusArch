import type { SubmitReadingPort } from "../../../application/ports/in/submit-reading.port";

export class ReadingMessageConsumer {
  constructor(private readonly submitReading: SubmitReadingPort) {}

  async onMessage(raw: string): Promise<"ack" | "reject"> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return "reject";
    }
    if (typeof parsed !== "object" || parsed === null) {
      return "reject";
    }
    const { meterId, kwh, takenAt } = parsed as Record<string, unknown>;
    if (typeof meterId !== "string" || typeof kwh !== "number" || typeof takenAt !== "string") {
      return "reject";
    }
    try {
      await this.submitReading.execute({ meterId, kwh, takenAt });
      return "ack";
    } catch {
      return "reject";
    }
  }
}
