import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ArtworksService } from './artworks.service';
import { ConditionChecksService, ConditionCheckView } from './condition-checks.service';
import { ArtworkView, MoveArtworkDto, RecordConditionDto, RegisterArtworkDto } from './dto/artwork.dto';

@Controller('artworks')
export class ArtworksController {
  constructor(
    private readonly artworks: ArtworksService,
    private readonly conditionChecks: ConditionChecksService,
  ) {}

  @Post()
  register(@Body() dto: RegisterArtworkDto): Promise<ArtworkView> {
    return this.artworks.register(dto.title, dto.artist, dto.year, dto.medium, dto.onLoan);
  }

  @Get()
  byArtist(@Query('artist') artist: string): Promise<ArtworkView[]> {
    return this.artworks.byArtist(artist);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ArtworkView> {
    return this.artworks.findOne(id);
  }

  @Patch(':id/location')
  move(@Param('id') id: string, @Body() dto: MoveArtworkDto): Promise<ArtworkView> {
    return this.artworks.move(id, dto.location);
  }

  @Post(':id/condition-checks')
  recordCondition(@Param('id') id: string, @Body() dto: RecordConditionDto): Promise<ConditionCheckView> {
    return this.conditionChecks.record(id, dto.grade, dto.inspector, dto.notes);
  }

  @Get(':id/condition-checks')
  conditionHistory(@Param('id') id: string): Promise<ConditionCheckView[]> {
    return this.conditionChecks.history(id);
  }
}
