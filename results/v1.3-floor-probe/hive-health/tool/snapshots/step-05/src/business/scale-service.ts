import { DomainError, SWARM_DROP_KG, ScaleReading, SwarmAlert, dropWithinHour } from './model';
import { HiveRepository, InspectionRepository } from '../persistence/hive-repository';
import { ScaleRepository } from '../persistence/scale-repository';
import { TextHiveClient } from '../persistence/texthive-client';

export class ScaleService {
  constructor(
    private readonly hives: HiveRepository,
    private readonly scales: ScaleRepository,
    private readonly sms: TextHiveClient,
    private readonly inspections: InspectionRepository,
    private readonly holdMs = 60 * 60 * 1000,
  ) {}

  /** HOTFIX: an inspection recorded from 2 h before to 1 h after the drop explains it. */
  private inspectionExplains(hiveId: string, at: string): boolean {
    const t = new Date(at).getTime();
    return this.inspections
      .forHive(hiveId)
      .some((i) => i.recordedAt !== undefined && new Date(i.recordedAt).getTime() >= t - 2 * 3600000 && new Date(i.recordedAt).getTime() <= t + 3600000);
  }

  linkScale(memberId: string, serial: string, hiveId: string): void {
    const hive = this.hives.hive(hiveId);
    if (!hive) throw new DomainError('hive not found', 404);
    if (hive.ownerId !== memberId) throw new DomainError('only the hive owner can link a scale', 403);
    this.scales.link(serial, hiveId);
  }

  async recordReading(serial: string, kg: number, time: string): Promise<{ reading: ScaleReading; alert?: SwarmAlert }> {
    const hiveId = this.scales.hiveFor(serial);
    if (!hiveId) throw new DomainError(`scale ${serial} is not linked to a hive`, 422);
    const reading: ScaleReading = { serial, hiveId, kg, time };
    const drop = dropWithinHour(this.scales.readingsForHive(hiveId), reading);
    this.scales.addReading(reading);
    if (drop <= SWARM_DROP_KG) return { reading };
    const alert = await this.alertOwner(hiveId, drop, time);
    return { reading, alert };
  }

  private async alertOwner(hiveId: string, drop: number, at: string): Promise<SwarmAlert | undefined> {
    // one alert per hour per hive
    const recent = this.scales.alertsForHive(hiveId).some((a) => Math.abs(new Date(a.at).getTime() - new Date(at).getTime()) < 3600000);
    if (recent) return undefined;
    const hive = this.hives.hive(hiveId);
    const owner = hive ? this.hives.member(hive.ownerId) : undefined;
    const alert: SwarmAlert = { hiveId, dropKg: Math.round(drop * 10) / 10, at };
    this.scales.addAlert(alert);
    if (this.inspectionExplains(hiveId, at)) {
      alert.cancelled = true;
      return alert;
    }
    // hold the SMS for an hour: an inspection recorded in that hour cancels it
    const phone = owner?.phone;
    if (phone) {
      setTimeout(() => {
        if (this.inspectionExplains(hiveId, at)) {
          alert.cancelled = true;
          return;
        }
        this.sms
          .sendSms(phone, `Possible swarm: hive ${hive?.label} lost ${alert.dropKg} kg in the last hour.`)
          .then(() => (alert.sentTo = phone))
          .catch((e) => console.error('swarm SMS failed', e));
      }, this.holdMs);
    }
    return alert;
  }
}
