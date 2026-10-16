import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'drives', timestamps: true })
export class Drive {
  @Prop({ required: true })
  siteName!: string;

  @Prop({ required: true })
  region!: string;

  @Prop({ required: true })
  opensAt!: Date;

  @Prop({ required: true })
  closesAt!: Date;

  @Prop({ required: true })
  beds!: number;

  @Prop({ required: true })
  slotMinutes!: number;

  @Prop({ default: 'scheduled' })
  status!: string;

  @Prop({ default: 0 })
  collectedUnits!: number;
}

export type DriveDocument = HydratedDocument<Drive>;
export const DriveSchema = SchemaFactory.createForClass(Drive);
