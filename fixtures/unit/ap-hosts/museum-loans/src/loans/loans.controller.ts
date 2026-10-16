import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { LoansService } from './loans.service';
import { ApproveLoanDto, LoanView, RecordReturnDto, RequestLoanDto } from './dto/loan.dto';

@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Post()
  request(@Body() dto: RequestLoanDto): Promise<LoanView> {
    return this.loans.request(dto.artworkId, dto.lenderId, dto.startsOn, dto.endsOn, dto.insuredValue, dto.currency);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<LoanView> {
    return this.loans.findOne(id);
  }

  @Patch(':id/approval')
  approve(@Param('id') id: string, @Body() dto: ApproveLoanDto): Promise<LoanView> {
    return this.loans.approve(id, dto.registrarId);
  }

  @Patch(':id/return')
  recordReturn(@Param('id') id: string, @Body() dto: RecordReturnDto): Promise<LoanView> {
    return this.loans.recordReturn(id, dto.conditionGrade, dto.courier);
  }
}
