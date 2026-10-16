import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isBloodType, UnknownBloodTypeError } from '../domain/blood-type';
import { Clock, CLOCK } from '../domain/clock';
import { isDeferralReason, MAX_DEFERRAL_WEEKS, UnknownDeferralReasonError } from '../domain/deferral';
import { DonationInterval, MIN_INTERVAL_DAYS } from '../domain/donation-interval';
import { DonorAge, MAX_DONOR_AGE, MIN_DONOR_AGE } from '../domain/donor-age';
import { Donor, DonorDocument } from '../persistence/schemas/donor.schema';
import { DonorView, toDonorView } from './dto/donor.dto';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class DonorsService {
  constructor(
    @InjectModel(Donor.name) private readonly donors: Model<DonorDocument>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async register(fullName: string, birthDate: string, sex: string, bloodType: string, phone: string): Promise<DonorView> {
    if (fullName.trim().length < 2) {
      throw new BadRequestException('A donor needs a full name');
    }
    if (Number.isNaN(Date.parse(birthDate))) {
      throw new BadRequestException(`birthDate must be a date like 1990-04-21; got ${birthDate}`);
    }
    if (bloodType !== 'unknown' && !isBloodType(bloodType)) {
      throw new UnknownBloodTypeError(bloodType);
    }
    if (!/^\+?[0-9 ]{7,16}$/.test(phone)) {
      throw new BadRequestException('Phone numbers are digits and spaces, optionally with a leading +');
    }
    if (!new DonorAge(new Date(birthDate), this.clock.now()).isEligible()) {
      throw new BadRequestException(`Donors are ${String(MIN_DONOR_AGE)} to ${String(MAX_DONOR_AGE)} years old`);
    }
    const donor = await this.donors.create({ fullName: fullName.trim(), birthDate, sex, bloodType, phone, lastDonationAt: null, deferral: null });
    return toDonorView(donor, null);
  }

  async defer(donorId: string, reason: string, weeks: number): Promise<DonorView> {
    if (!isDeferralReason(reason)) {
      throw new UnknownDeferralReasonError(reason);
    }
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_DEFERRAL_WEEKS) {
      throw new BadRequestException(`A temporary deferral lasts 1 to ${String(MAX_DEFERRAL_WEEKS)} weeks`);
    }
    const until = new Date(this.clock.now().getTime() + weeks * WEEK_MS);
    const donor = await this.donors.findByIdAndUpdate(donorId, { $set: { deferral: { reason, until } } }, { new: true });
    if (donor === null) {
      throw new NotFoundException(`Donor ${donorId} not found`);
    }
    return this.view(donor);
  }

  async findOne(donorId: string): Promise<DonorView> {
    const donor = await this.donors.findById(donorId);
    if (donor === null) {
      throw new NotFoundException(`Donor ${donorId} not found`);
    }
    return this.view(donor);
  }

  async recallCandidates(bloodType: string, limit: number): Promise<DonorView[]> {
    if (limit < 1 || limit > 500) {
      throw new BadRequestException('limit is 1 to 500');
    }
    const donors = await this.donors.find({ bloodType, deferral: null }, null, { sort: { lastDonationAt: 1 }, limit });
    const today = this.clock.now();
    return donors.map((d) => this.view(d)).filter((v) => v.nextEligibleOn === null || Date.parse(v.nextEligibleOn) <= today.getTime());
  }

  private view(donor: DonorDocument): DonorView {
    const interval = new DonationInterval(donor.lastDonationAt, MIN_INTERVAL_DAYS[donor.sex] ?? 112);
    return toDonorView(donor, interval.nextEligibleOn());
  }
}
