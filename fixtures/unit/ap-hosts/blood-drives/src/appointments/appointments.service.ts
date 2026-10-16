import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Deferral, DonorDeferredError } from '../domain/deferral';
import { DonationInterval, MIN_INTERVAL_DAYS } from '../domain/donation-interval';
import { DriveSchedule } from '../domain/drive-schedule';
import { Appointment, AppointmentDocument } from '../persistence/schemas/appointment.schema';
import { Donor, DonorDocument } from '../persistence/schemas/donor.schema';
import { Drive, DriveDocument } from '../persistence/schemas/drive.schema';
import { AppointmentView, toAppointmentView } from './dto/appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<AppointmentDocument>,
    @InjectModel(Drive.name) private readonly drives: Model<DriveDocument>,
    @InjectModel(Donor.name) private readonly donors: Model<DonorDocument>,
  ) {}

  async book(driveId: string, donorId: string, startsAt: string): Promise<AppointmentView> {
    if (Number.isNaN(Date.parse(startsAt))) {
      throw new BadRequestException(`startsAt must be an ISO timestamp; got ${startsAt}`);
    }
    const [drive, donor] = await Promise.all([this.drives.findById(driveId), this.donors.findById(donorId)]);
    if (drive === null || donor === null) {
      throw new NotFoundException('Unknown drive or donor');
    }
    const at = new Date(startsAt);
    const schedule = new DriveSchedule(drive.opensAt, drive.closesAt, drive.beds, drive.slotMinutes);
    if (!schedule.isSlotStart(at)) {
      throw new BadRequestException(`Slots start every ${String(drive.slotMinutes)} minutes from opening`);
    }
    if (donor.deferral !== null && new Deferral(donor.deferral.reason, donor.deferral.until).isActiveOn(at)) {
      throw new DonorDeferredError(donor.deferral.until);
    }
    const interval = new DonationInterval(donor.lastDonationAt, MIN_INTERVAL_DAYS[donor.sex] ?? 112);
    if (!interval.allowsDonationOn(at)) {
      throw new BadRequestException(`Next eligible on ${interval.nextEligibleOn()?.toISOString().slice(0, 10) ?? '?'}`);
    }
    schedule.ensureBedFree(driveId, await this.appointments.countDocuments({ driveId, startsAt: at, status: 'booked' }));
    return toAppointmentView(await this.appointments.create({ driveId, donorId, startsAt: at, status: 'booked' }));
  }

  async cancel(appointmentId: string, reason: string): Promise<AppointmentView> {
    if (reason.trim().length === 0) {
      throw new BadRequestException('Cancellations record a reason for the no-show statistics');
    }
    const updated = await this.appointments.findByIdAndUpdate(appointmentId, { $set: { status: 'cancelled', cancelReason: reason.trim() } }, { new: true });
    if (updated === null) {
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }
    return toAppointmentView(updated);
  }

  async forDrive(driveId: string): Promise<AppointmentView[]> {
    return (await this.appointments.find({ driveId }, null, { sort: { startsAt: 1 } })).map(toAppointmentView);
  }
}
