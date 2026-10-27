import { ApplyCommand, ApplyToOpening } from "./ports/in/apply-to-opening";
import { ApplicationRepository } from "./ports/out/application-repository";
import { OpeningRepository } from "./ports/out/opening-repository";
import { Notifier } from "./ports/out/notifier";
import { CandidateApplication } from "../domain/candidate-application";
import { Email } from "../domain/email";
import { EligibilityService } from "../domain/eligibility-service";
import { DuplicateApplicationError, NotFoundError } from "../domain/errors";

export class ApplyToOpeningUseCase implements ApplyToOpening {
  constructor(
    private readonly openings: OpeningRepository,
    private readonly applications: ApplicationRepository,
    private readonly eligibility: EligibilityService,
    private readonly notifier: Notifier,
  ) {}

  async execute(cmd: ApplyCommand): Promise<{ applicationId: string }> {
    const now = new Date();
    const opening = await this.openings.findById(cmd.openingId);
    if (!opening) {
      throw new NotFoundError("Opening", cmd.openingId);
    }
    opening.assertOpenAt(now);
    const email = Email.parse(cmd.email);
    const existing = await this.applications.findByOpeningAndEmail(opening.id, email.value);
    if (existing) {
      throw new DuplicateApplicationError(opening.id, email.value);
    }
    const app = new CandidateApplication(`app-${Date.now()}`, opening.id, cmd.name, email, cmd.yearsExperience);
    if (
      !this.eligibility.meetsMinimumExperience(app.yearsExperience, opening.minYears) ||
      !this.eligibility.isEligible(app, opening, now)
    ) {
      app.reject();
    }
    await this.applications.save(app);
    await this.notifier.notifyReceived(email.value, opening.title);
    return { applicationId: app.id };
  }
}
