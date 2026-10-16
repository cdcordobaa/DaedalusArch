import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../../domain/domain-error';

/** Maps broken collection rules to 422 with the rule's code, so clients can branch on it. */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(422).json({ code: error.code, message: error.message });
  }
}
