import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import { Repository } from 'typeorm';
import { Appointment, AppointmentDocument } from '../persistence/schemas/appointment.schema';
import { Drive, DriveDocument } from '../persistence/schemas/drive.schema';
import { DriveStatsRow } from '../persistence/warehouse/drive-stats.entity';

export interface DriveStatsView {
  readonly driveId: string;
  readonly region: string;
  readonly driveDate: string;
  readonly booked: number;
  readonly collectedUnits: number;
  readonly fillRate: number;
}

/** Loads closed drives into the warehouse and serves the planning team's monthly figures. */
@Injectable()
export class DriveStatsService {
  constructor(
    @InjectRepository(DriveStatsRow) private readonly stats: Repository<DriveStatsRow>,
    @InjectModel(Drive.name) private readonly drives: Model<DriveDocument>,
    @InjectModel(Appointment.name) private readonly appointments: Model<AppointmentDocument>,
  ) {}

  async load(driveId: string): Promise<DriveStatsView> {
    const drive = await this.drives.findById(driveId);
    if (drive === null || drive.status !== 'closed') {
      throw new NotFoundException(`No closed drive ${driveId}`);
    }
    const booked = await this.appointments.countDocuments({ driveId });
    const row = (await this.stats.findOne({ where: { driveId } })) ?? this.stats.create({ driveId });
    row.region = drive.region;
    row.driveDate = drive.opensAt.toISOString().slice(0, 10);
    row.booked = booked;
    row.collectedUnits = drive.collectedUnits;
    row.deferredDonors = 0;
    return this.view(await this.stats.save(row));
  }

  async month(region: string, year: number, month: number): Promise<DriveStatsView[]> {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month is 1 to 12');
    }
    if (!Number.isInteger(year) || year < 2000) {
      throw new BadRequestException('year is a four-digit year');
    }
    const prefix = `${String(year)}-${String(month).padStart(2, '0')}`;
    const rows = await this.stats.find({ where: { region }, order: { driveDate: 'ASC' } });
    return rows.filter((r) => r.driveDate.startsWith(prefix)).map((r) => this.view(r));
  }

  private view(row: DriveStatsRow): DriveStatsView {
    return { driveId: row.driveId, region: row.region, driveDate: row.driveDate, booked: row.booked, collectedUnits: row.collectedUnits, fillRate: row.booked === 0 ? 0 : row.collectedUnits / row.booked };
  }
}
