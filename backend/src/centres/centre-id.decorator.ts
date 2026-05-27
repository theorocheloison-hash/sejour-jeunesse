import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CentreId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const header = request.headers['x-centre-id'];
    if (!header) return null;
    return Array.isArray(header) ? (header[0] ?? null) : header;
  },
);
