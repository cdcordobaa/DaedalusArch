import { randomUUID } from 'node:crypto';
import { Apiary, DomainError, Hive, Inspection, Member, needsTreatment, validateInspection } from './model';
import { HiveRepository, InspectionRepository } from '../persistence/hive-repository';

export interface HiveView extends Hive {
  flaggedForTreatment: boolean;
}

export class ApiaryService {
  constructor(private readonly hives: HiveRepository, private readonly inspections: InspectionRepository) {}

  registerMember(name: string, phone?: string): Member {
    if (!name) throw new DomainError('name is required');
    return this.hives.saveMember({ id: randomUUID(), name, phone });
  }

  registerApiary(memberId: string, name: string, region: string): Apiary {
    this.requireMember(memberId);
    if (!name || !region) throw new DomainError('name and region are required');
    return this.hives.saveApiary({ id: randomUUID(), name, region, ownerId: memberId });
  }

  addHive(memberId: string, apiaryId: string, label: string): Hive {
    const apiary = this.hives.apiary(apiaryId);
    if (!apiary) throw new DomainError('apiary not found', 404);
    if (apiary.ownerId !== memberId) throw new DomainError('only the apiary owner can add hives', 403);
    return this.hives.saveHive({ id: randomUUID(), apiaryId, ownerId: memberId, label });
  }

  recordInspection(memberId: string, hiveId: string, input: Omit<Inspection, 'id' | 'hiveId' | 'recordedBy'>): Inspection {
    const hive = this.hives.hive(hiveId);
    if (!hive) throw new DomainError('hive not found', 404);
    if (hive.ownerId !== memberId) throw new DomainError('only the hive owner can record inspections', 403);
    const inspection = { ...input, hiveId, recordedBy: memberId };
    validateInspection(inspection);
    return this.inspections.save({ id: randomUUID(), ...inspection });
  }

  hiveView(hiveId: string): HiveView {
    const hive = this.hives.hive(hiveId);
    if (!hive) throw new DomainError('hive not found', 404);
    return { ...hive, flaggedForTreatment: needsTreatment(this.inspections.latestForHive(hiveId)) };
  }

  hivesInApiary(apiaryId: string): HiveView[] {
    return this.hives.hivesIn(apiaryId).map((h) => this.hiveView(h.id));
  }

  inspectionsOf(hiveId: string): Inspection[] {
    return this.inspections.forHive(hiveId);
  }

  flaggedHives(): HiveView[] {
    return this.hives.allHives().map((h) => this.hiveView(h.id)).filter((h) => h.flaggedForTreatment);
  }

  private requireMember(id: string): Member {
    const m = this.hives.member(id);
    if (!m) throw new DomainError('member not found', 404);
    return m;
  }
}
