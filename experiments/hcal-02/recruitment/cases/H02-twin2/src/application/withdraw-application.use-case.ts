import { ApplicationRepository } from "./ports/out/application-repository";
import { Notifier } from "./ports/out/notifier";
import { NotFoundError } from "../domain/errors";

export class WithdrawApplicationUseCase {
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly notifier: Notifier,
  ) {}

  async execute(applicationId: string): Promise<void> {
    const app = await this.applications.findById(applicationId);
    if (!app) {
      throw new NotFoundError("Application", applicationId);
    }
    app.reject();
    await this.applications.save(app);
    await this.notifier.notifyReceived(app.email.value, "withdrawn");
  }
}
