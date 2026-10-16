import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExhibitionRecord } from '../persistence/entities/exhibition.entity';
import { PlacementRecord } from '../persistence/entities/placement.entity';
import { ExhibitionLayoutService } from './exhibition-layout.service';
import { ExhibitionsController } from './exhibitions.controller';
import { ExhibitionsService } from './exhibitions.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExhibitionRecord, PlacementRecord])],
  controllers: [ExhibitionsController],
  providers: [ExhibitionsService, ExhibitionLayoutService],
})
export class ExhibitionsModule {}
