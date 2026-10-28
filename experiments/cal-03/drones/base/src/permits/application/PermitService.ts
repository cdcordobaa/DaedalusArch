import type { EventBus } from '../../shared-kernel/EventBus';
import type { UnitOfWork } from '../../shared-kernel/UnitOfWork';
import { PermitGranted } from '../domain/events/PermitGranted';
import { FlightPermit } from '../domain/permit/FlightPermit';
import type { PermitRepository } from '../domain/permit/PermitRepository';
import { DateWindow } from '../domain/permit/value-objects/DateWindow';
import type { PermitDto } from '../contracts/PermitDto';
import type { AirspaceAuthority } from './ports/AirspaceAuthority';

export class PermitService {
  constructor(
    private readonly permits: PermitRepository,
    private readonly authority: AirspaceAuthority,
    private readonly bus: EventBus,
    private readonly uow: UnitOfWork,
  ) {}

  requestPermit(surveyId: string, from: Date, to: Date): string {
    const permit = FlightPermit.request(this.permits.nextId(), surveyId, new DateWindow(from, to));
    this.permits.save(permit);
    return permit.id;
  }

  submitToAuthority(permitId: string): void {
    const permit = this.load(permitId);
    const reference = this.authority.requestClearance(permit.surveyId, permit.window.start, permit.window.end);
    this.uow.run(() => {
      permit.grant(reference);
      this.permits.save(permit);
    });
    this.bus.publish(new PermitGranted(permit.surveyId, permit.id, reference));
  }

  deny(permitId: string, reason: string): void {
    const permit = this.load(permitId);
    permit.deny(reason);
    this.permits.save(permit);
  }

  getPermit(permitId: string): PermitDto {
    const permit = this.load(permitId);
    return { id: permit.id, surveyId: permit.surveyId, status: permit.status, reference: permit.reference };
  }

  private load(id: string): FlightPermit {
    const permit = this.permits.findById(id);
    if (!permit) {
      throw new Error(`permit ${id} not found`);
    }
    return permit;
  }
}
