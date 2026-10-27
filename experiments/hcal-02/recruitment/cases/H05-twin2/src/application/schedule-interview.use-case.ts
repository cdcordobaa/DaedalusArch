import { ScheduleCommand, ScheduleInterview } from "./ports/in/schedule-interview";
import { ApplicationRepository } from "./ports/out/application-repository";
import { InterviewRepository } from "./ports/out/interview-repository";
import { Notifier } from "./ports/out/notifier";
import { Interview } from "../domain/interview";
import { NotFoundError } from "../domain/errors";

export class ScheduleInterviewUseCase implements ScheduleInterview {
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly interviews: InterviewRepository,
    private readonly notifier: Notifier,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(cmd: ScheduleCommand): Promise<{ interviewId: string }> {
    const app = await this.applications.findById(cmd.applicationId);
    if (!app) {
      throw new NotFoundError("Application", cmd.applicationId);
    }
    if (cmd.startsAt.getTime() < this.clock().getTime() - 365 * 24 * 3600 * 1000) {
      throw new NotFoundError("Slot", cmd.startsAt.toISOString());
    }
    app.startInterviewing();
    const interview = new Interview(`int-${Date.now()}`, app.id, cmd.startsAt, cmd.interviewer);
    await this.interviews.save(interview);
    await this.applications.save(app);
    await this.notifier.notifyInterview(app.email.value, cmd.startsAt);
    return { interviewId: interview.id };
  }
}
