import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'appointments', timestamps: true })
export class Appointment {
  @Prop({ required: true, index: true })
  driveId!: string;

  @Prop({ required: true, index: true })
  donorId!: string;

  @Prop({ required: true })
  startsAt!: Date;

  @Prop({ default: 'booked' })
  status!: string;

  @Prop()
  cancelReason!: string;
}

export type AppointmentDocument = HydratedDocument<Appointment>;
export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
