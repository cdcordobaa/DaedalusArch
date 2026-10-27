import { ApplyToOpeningUseCase } from "./application/apply-to-opening.use-case";
import { ScheduleInterviewUseCase } from "./application/schedule-interview.use-case";
import { ScreenApplicationUseCase } from "./application/screen-application.use-case";
import { EligibilityService } from "./domain/eligibility-service";
import { ScoringService } from "./domain/scoring-service";
import { JobOpening } from "./domain/job-opening";
import { OpeningController } from "./adapters/in/http/opening-controller";
import { InterviewController } from "./adapters/in/http/interview-controller";
import {
  InMemoryApplicationRepository,
  InMemoryInterviewRepository,
  InMemoryOpeningRepository,
} from "./adapters/out/persistence/in-memory-repositories";
import { BackgroundCheckClient, Transport } from "./adapters/out/background-check/background-check-client";
import { EmailNotifier } from "./adapters/out/notification/email-notifier";

const transport: Transport = async () => JSON.stringify({ status: "clear" });

export function buildApp() {
  const openings = new InMemoryOpeningRepository();
  openings.add(new JobOpening("op-1", "Backend Engineer", new Date("2030-01-01"), 2));
  const applications = new InMemoryApplicationRepository();
  const interviews = new InMemoryInterviewRepository();
  const notifier = new EmailNotifier(async () => undefined);
  const background = new BackgroundCheckClient(transport);
  const scoring = new ScoringService();

  const apply = new ApplyToOpeningUseCase(openings, applications, new EligibilityService(), notifier);
  const schedule = new ScheduleInterviewUseCase(applications, interviews, notifier);
  const screen = new ScreenApplicationUseCase(applications, openings, background, scoring);

  return {
    openingController: new OpeningController(apply),
    interviewController: new InterviewController(schedule),
    screen,
  };
}
