import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ExhibitionLayoutService, PlacementView } from './exhibition-layout.service';
import { ExhibitionsService } from './exhibitions.service';
import { ExhibitionView, PlaceArtworkDto, RescheduleExhibitionDto, ScheduleExhibitionDto } from './dto/exhibition.dto';

@Controller('exhibitions')
export class ExhibitionsController {
  constructor(
    private readonly exhibitions: ExhibitionsService,
    private readonly layout: ExhibitionLayoutService,
  ) {}

  @Post()
  schedule(@Body() dto: ScheduleExhibitionDto): Promise<ExhibitionView> {
    return this.exhibitions.schedule(dto.title, dto.galleryCode, dto.opensOn, dto.closesOn, dto.capacity);
  }

  @Get('upcoming')
  upcoming(@Query('limit') limit?: string): Promise<ExhibitionView[]> {
    return this.exhibitions.upcoming(limit === undefined ? 20 : Number(limit));
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ExhibitionView> {
    return this.exhibitions.findOne(id);
  }

  @Patch(':id/schedule')
  reschedule(@Param('id') id: string, @Body() dto: RescheduleExhibitionDto): Promise<ExhibitionView> {
    return this.exhibitions.reschedule(id, dto.opensOn, dto.closesOn);
  }

  @Patch(':id/capacity')
  changeCapacity(@Param('id') id: string, @Body() body: { capacity: number }): Promise<ExhibitionView> {
    return this.exhibitions.changeCapacity(id, body.capacity);
  }

  @Post(':id/placements')
  place(@Param('id') id: string, @Body() dto: PlaceArtworkDto): Promise<PlacementView> {
    return this.layout.place(id, dto.artworkId, dto.wall, dto.position);
  }

  @Get(':id/placements')
  plan(@Param('id') id: string): Promise<PlacementView[]> {
    return this.layout.plan(id);
  }

  @Delete(':id/placements/:artworkId')
  @HttpCode(204)
  unplace(@Param('id') id: string, @Param('artworkId') artworkId: string): Promise<void> {
    return this.layout.remove(id, artworkId);
  }
}
