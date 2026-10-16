import { DriveDocument } from '../../persistence/schemas/drive.schema';

export class ScheduleDriveDto {
  siteName!: string;
  region!: string;
  opensAt!: string;
  closesAt!: string;
  beds!: number;
  slotMinutes!: number;
}

export class CloseDriveDto {
  collectedUnits!: number;
}

export interface DriveView {
  readonly id: string;
  readonly siteName: string;
  readonly region: string;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly beds: number;
  readonly status: string;
}

export function toDriveView(d: DriveDocument): DriveView {
  return { id: d.id, siteName: d.siteName, region: d.region, opensAt: d.opensAt.toISOString(), closesAt: d.closesAt.toISOString(), beds: d.beds, status: d.status };
}
