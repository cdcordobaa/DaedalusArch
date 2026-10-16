import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

export const API_KEY_HEADER = 'x-api-key';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    return (request.headers[API_KEY_HEADER] ?? '').length > 0;
  }
}
