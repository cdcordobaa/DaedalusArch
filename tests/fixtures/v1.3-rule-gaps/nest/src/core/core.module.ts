import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';

// Re-exports SharedModule.
@Module({ imports: [SharedModule], exports: [SharedModule] })
export class CoreModule {}
