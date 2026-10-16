import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtworkRecord } from '../persistence/entities/artwork.entity';
import { ConditionCheckRecord } from '../persistence/entities/condition-check.entity';
import { ArtworksController } from './artworks.controller';
import { ArtworksService } from './artworks.service';
import { ConditionChecksService } from './condition-checks.service';

@Module({
  imports: [TypeOrmModule.forFeature([ArtworkRecord, ConditionCheckRecord])],
  controllers: [ArtworksController],
  providers: [ArtworksService, ConditionChecksService],
})
export class ArtworksModule {}
