import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LenderRecord } from '../persistence/entities/lender.entity';
import { LendersController } from './lenders.controller';
import { LendersService } from './lenders.service';

@Module({
  imports: [TypeOrmModule.forFeature([LenderRecord])],
  controllers: [LendersController],
  providers: [LendersService],
})
export class LendersModule {}
