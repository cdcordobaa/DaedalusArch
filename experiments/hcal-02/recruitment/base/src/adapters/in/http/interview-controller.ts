import { ScheduleInterview } from "../../../application/ports/in/schedule-interview";
import { HttpResponse, mapError } from "./http-errors";

export interface ScheduleRequest {
  readonly params: { readonly applicationId: string };
  readonly body: { readonly startsAt?: unknown; readonly interviewer?: unknown };
}

export class InterviewController {
  constructor(private readonly schedule: ScheduleInterview) {}

  async postInterview(req: ScheduleRequest): Promise<HttpResponse> {
    const { startsAt, interviewer } = req.body;
    if (typeof startsAt !== "string" || typeof interviewer !== "string") {
      return { status: 400, body: { message: "malformed body" } };
    }
    try {
      const result = await this.schedule.execute({
        applicationId: req.params.applicationId,
        startsAt: new Date(startsAt),
        interviewer,
      });
      return { status: 201, body: result };
    } catch (e) {
      return mapError(e);
    }
  }
}
