import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { DomainError, DomainErrorKind } from '../../domain/domain-error';

const STATUS: Record<DomainErrorKind, HttpStatus> = {
  'not-found': HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  invalid: HttpStatus.BAD_REQUEST,
};

interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

/** Exception filter (NestJS docs, "Exception filters"): maps domain errors to HTTP status codes. */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(exception: DomainError, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<JsonResponse>().status(STATUS[exception.kind]).json({ message: exception.message });
  }
}
