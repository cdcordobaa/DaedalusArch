import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriveSchedule } from '../domain/drive-schedule';
import { Drive, DriveDocument } from '../persistence/schemas/drive.schema';
import { DriveView, toDriveView } from './dto/drive.dto';

@Injectable()
export class DrivesService {
  constructor(@InjectModel(Drive.name) private readonly drives: Model<DriveDocument>) {}

  async schedule(siteName: string, region: string, opensAt: string, closesAt: string, beds: number, slotMinutes: number): Promise<DriveView> {
    if (siteName.trim().length === 0) {
      throw new BadRequestException('A drive needs the name of its host site');
    }
    if (!Number.isInteger(beds) || beds < 1 || beds > 24) {
      throw new BadRequestException('A mobile unit runs 1 to 24 beds');
    }
    if (slotMinutes !== 10 && slotMinutes !== 15 && slotMinutes !== 20) {
      throw new BadRequestException('Appointment slots are 10, 15 or 20 minutes');
    }
    if (Date.parse(closesAt) <= Date.parse(opensAt)) {
      throw new BadRequestException('A drive must close after it opens');
    }
    const schedule = new DriveSchedule(new Date(opensAt), new Date(closesAt), beds, slotMinutes);
    const drive = await this.drives.create({ siteName: siteName.trim(), region, opensAt: schedule.opensAt, closesAt: schedule.closesAt, beds, slotMinutes, status: 'scheduled', collectedUnits: 0 });
    return toDriveView(drive);
  }

  async close(driveId: string, collectedUnits: number): Promise<DriveView> {
    if (!Number.isInteger(collectedUnits) || collectedUnits < 0) {
      throw new BadRequestException('collectedUnits is a count of bags');
    }
    const drive = await this.drives.findById(driveId);
    if (drive === null) {
      throw new NotFoundException(`Drive ${driveId} not found`);
    }
    if (drive.status !== 'scheduled') {
      throw new ConflictException(`Drive ${driveId} is already ${drive.status}`);
    }
    const closed = await this.drives.findByIdAndUpdate(driveId, { $set: { status: 'closed', collectedUnits } }, { new: true });
    return toDriveView(closed ?? drive);
  }

  async inRegion(region: string, from: string): Promise<DriveView[]> {
    const drives = await this.drives.find({ region, opensAt: { $gte: new Date(from) } }, null, { sort: { opensAt: 1 } });
    return drives.map(toDriveView);
  }
}
