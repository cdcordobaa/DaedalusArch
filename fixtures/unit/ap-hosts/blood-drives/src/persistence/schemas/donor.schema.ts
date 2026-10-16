import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'donors', timestamps: true })
export class Donor {
  @Prop({ required: true })
  fullName!: string;

  @Prop({ required: true })
  birthDate!: string;

  @Prop({ required: true, enum: ['female', 'male', 'other'] })
  sex!: string;

  @Prop()
  bloodType!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ type: Date, default: null })
  lastDonationAt!: Date | null;

  @Prop({ type: Object, default: null })
  deferral!: { reason: string; until: Date } | null;
}

export type DonorDocument = HydratedDocument<Donor>;
export const DonorSchema = SchemaFactory.createForClass(Donor);
