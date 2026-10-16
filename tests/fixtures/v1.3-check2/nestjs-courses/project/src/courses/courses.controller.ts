import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Course } from '../domain/course';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  create(@Body() dto: CreateCourseDto): Promise<Course> {
    return this.coursesService.create(dto.title, dto.capacity);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string): Promise<Course> {
    return this.coursesService.publish(id);
  }

  @Get()
  catalogue(): Promise<Course[]> {
    return this.coursesService.catalogue();
  }
}
