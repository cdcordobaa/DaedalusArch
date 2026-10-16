import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { NotificationsService } from './notifications.service';

@Module({ imports: [CoreModule], providers: [NotificationsService] })
export class NotificationsModule {}
