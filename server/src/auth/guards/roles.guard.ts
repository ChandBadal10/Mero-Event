import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    //  Get the roles allowed for this API
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    //  If no role is specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    //  Get the current request
    const request = context.switchToHttp().getRequest();

    //  Get authenticated user information
    const user = request.user;

    //  Check whether the user's role is allowed
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    //  Allow access
    return true;
  }
}