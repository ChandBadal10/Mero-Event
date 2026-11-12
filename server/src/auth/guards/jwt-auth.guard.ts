import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the current HTTP request
    const request = context.switchToHttp().getRequest();

    // Get the Authorization header
    const authorization = request.headers.authorization;

    //  Check whether token exists
    if (!authorization) {
      throw new UnauthorizedException(
        'Access token is required',
      );
    }

    // Extract Bearer token
    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Invalid authorization format',
      );
    }

    //  Verify the access token
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });

      //  Attach user information to request
      request.user = payload;

    } catch {
      throw new UnauthorizedException(
        'Invalid or expired access token',
      );
    }

    //  Allow the request
    return true;
  }
}