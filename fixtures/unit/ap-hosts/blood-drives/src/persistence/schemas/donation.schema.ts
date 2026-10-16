import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'donations', timestamps: true })
export class Donation {
  @Prop({ required: true, unique: true })
  appointmentId!: string;

  @Prop({ required: true, index: true })
  driveId!: string;

  @Prop({ required: true })
  donorId!: string;

  @Prop({ required: true })
  hemoglobin!: number;

  @Prop({ required: true })
  volumeMl!: number;

  @Prop({ required: true, unique: true })
  bagNumber!: string;

  @Prop({ required: true })
  collectedAt!: Date;
}

export type DonationDocument = HydratedDocument<Donation>;
export const DonationSchema = SchemaFactory.createForClass(Donation);
