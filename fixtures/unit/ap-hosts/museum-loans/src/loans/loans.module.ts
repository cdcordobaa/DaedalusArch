import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanRecord } from '../persistence/entities/loan.entity';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [TypeOrmModule.forFeature([LoanRecord])],
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}
