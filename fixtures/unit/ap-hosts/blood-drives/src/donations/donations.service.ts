import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clock, CLOCK } from '../domain/clock';
import { CollectedUnit, MAX_UNIT_ML, MIN_UNIT_ML, UnitVolumeError } from '../domain/collected-unit';
import { HemoglobinReading } from '../domain/hemoglobin';
import { Appointment, AppointmentDocument } from '../persistence/schemas/appointment.schema';
import { Donation, DonationDocument } from '../persistence/schemas/donation.schema';
import { Donor, DonorDocument } from '../persistence/schemas/donor.schema';
import { DonationView, toDonationView } from './dto/donation.dto';

@Injectable()
export class DonationsService {
  constructor(
    @InjectModel(Donation.name) private readonly donations: Model<DonationDocument>,
    @InjectModel(Appointment.name) private readonly appointments: Model<AppointmentDocument>,
    @InjectModel(Donor.name) private readonly donors: Model<DonorDocument>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async record(appointmentId: string, hemoglobin: number, volumeMl: number, bagNumber: string): Promise<DonationView> {
    if (hemoglobin <= 0 || hemoglobin > 25) {
      throw new BadRequestException('Hemoglobin is measured in g/dL');
    }
    if (volumeMl < MIN_UNIT_ML || volumeMl > MAX_UNIT_ML) {
      throw new UnitVolumeError(volumeMl);
    }
    if (!/^[A-Z]{1,2}[0-9]{6,8}$/.test(bagNumber)) {
      throw new BadRequestException(`Bag numbers are ISBT-128 donation ids; got ${bagNumber}`);
    }
    const appointment = await this.appointments.findById(appointmentId);
    if (appointment === null || appointment.status !== 'booked') {
      throw new NotFoundException(`No open appointment ${appointmentId}`);
    }
    const donor = await this.donors.findById(appointment.donorId);
    if (donor === null) {
      throw new NotFoundException(`Donor ${appointment.donorId} not found`);
    }
    new HemoglobinReading(hemoglobin).ensureSufficientFor(donor.sex);
    if ((await this.donations.countDocuments({ appointmentId })) > 0) {
      throw new ConflictException(`Appointment ${appointmentId} already has a donation`);
    }
    const unit = new CollectedUnit(volumeMl, bagNumber);
    const collectedAt = this.clock.now();
    const donation = await this.donations.create({ appointmentId, driveId: appointment.driveId, donorId: donor.id, hemoglobin, volumeMl: unit.volumeMl, bagNumber, collectedAt });
    await this.appointments.findByIdAndUpdate(appointmentId, { $set: { status: 'donated' } });
    await this.donors.findByIdAndUpdate(donor.id, { $set: { lastDonationAt: collectedAt } });
    return toDonationView(donation);
  }

  async forDrive(driveId: string): Promise<DonationView[]> {
    return (await this.donations.find({ driveId }, null, { sort: { collectedAt: 1 } })).map(toDonationView);
  }
}
