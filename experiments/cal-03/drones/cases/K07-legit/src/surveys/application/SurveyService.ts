import { EventBus } from '../../shared-kernel/EventBus';
import { Money } from '../../shared-kernel/Money';
import { UnitOfWork } from '../../shared-kernel/UnitOfWork';
import type { DeliverableKind } from '../domain/survey/value-objects/Deliverable';
import { Area } from '../domain/survey/value-objects/Area';
import { Deliverable } from '../domain/survey/value-objects/Deliverable';
import { FlightWindow } from '../domain/survey/value-objects/FlightWindow';
import { SurveyBooked } from '../domain/events/SurveyBooked';
import { SurveyCancelled } from '../domain/events/SurveyCancelled';
import { SurveyJob } from '../domain/survey/SurveyJob';
import type { SurveyRepository } from '../domain/survey/SurveyRepository';
import type { RequestSurveyCommand, SurveyDto } from '../contracts/SurveyDto';
import type { ClientNotifier } from './ports/ClientNotifier';

export class SurveyService {
  constructor(
    private readonly surveys: SurveyRepository,
    private readonly bus: EventBus,
    private readonly notifier: ClientNotifier,
    private readonly uow: UnitOfWork,
  ) {}

  requestSurvey(cmd: RequestSurveyCommand): string {
    const job = SurveyJob.draft(
      this.surveys.nextId(),
      cmd.clientEmail,
      cmd.siteName,
      Area.ofHectares(cmd.hectares),
      new FlightWindow(cmd.windowStart, cmd.windowEnd),
      cmd.deliverables.map((d) => new Deliverable(d.kind, d.format)),
      Money.of(cmd.ratePerHectareCents),
    );
    this.surveys.save(job);
    return job.id;
  }

  addDeliverable(id: string, kind: DeliverableKind, format: string): void {
    const job = this.load(id);
    job.addDeliverable(new Deliverable(kind, format));
    this.surveys.save(job);
  }

  bookSurvey(id: string): void {
    const job = this.load(id);
    this.uow.run(() => {
      job.book();
      this.surveys.save(job);
    });
    this.bus.publish(new SurveyBooked(job.id, job.siteName, job.window.start, job.window.end));
    this.notifier.notifyBooked(job.clientEmail, job.id);
  }

  markPermitted(id: string): void {
    const job = this.load(id);
    job.markPermitted();
    this.surveys.save(job);
  }

  recordPilot(id: string, pilotId: string): void {
    const job = this.load(id);
    job.assignPilot(pilotId);
    this.surveys.save(job);
  }

  cancelSurvey(id: string): void {
    const job = this.load(id);
    this.uow.run(() => {
      job.cancel();
      this.surveys.save(job);
      this.bus.publish(new SurveyCancelled(job.id));
    });
  }

  getSurvey(id: string): SurveyDto {
    const job = this.load(id);
    return {
      id: job.id,
      siteName: job.siteName,
      status: job.status,
      hectares: job.area.hectares,
      priceCents: job.price.cents,
      permitted: job.permitted,
      pilotId: job.pilotId,
      deliverables: job.deliverables.map((d) => d.kind),
    };
  }

  private load(id: string): SurveyJob {
    const job = this.surveys.findById(id);
    if (!job) {
      throw new Error(`survey ${id} not found`);
    }
    return job;
  }
}
