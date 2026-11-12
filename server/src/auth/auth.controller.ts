
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  //Register

  @Post('vendor/register')
  @HttpCode(HttpStatus.CREATED)
  async registerVendor(
    @Body() dto: VendorRegisterDto
    ) {
    return this.authService.registerVendor(dto);
}


  // Login
  @Post('vendor/login')
  @HttpCode(HttpStatus.OK)
  async vendorLogin(@Body() loginDto: LoginDto) {
    return this.authService.vendorLogin(loginDto);
  }

  //Refresh Token
  @Post("vendor/refresh")
  @HttpCode(HttpStatus.OK)
  async refreshVendorToken(
    @Body() refreshTokenDto: RefreshTokenDto
  ) {
    return this.authService.refreshVendorToken(refreshTokenDto)
  }


  //Logout
  @Post('vendor/logout')
  @HttpCode(HttpStatus.OK)
  async vendorLogout(
  @Body() refreshTokenDto: RefreshTokenDto,
  ) {
  return this.authService.vendorLogout(refreshTokenDto);
  }

  @Get('vendor/protected')
@UseGuards(JwtAuthGuard)
vendorProtected(@Req() request: any) {
  return {
    message: 'You have successfully accessed a protected API',

    user: {
      id: request.user.sub,
      email: request.user.email,
      role: request.user.role,
    },
  };
}

// ADMIN ONLY API
@Get('admin/role-protected')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
adminProtected(@Req() request: any) {
  return {
    message: 'Welcome Admin! You can access this API.',
    user: {
      id: request.user.sub,
      email: request.user.email,
      role: request.user.role,
    },
  };
}

// VENDOR ONLY API
@Get('vendor/role-protected')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDOR')
vendorRoleProtected(@Req() request: any) {
  return {
    message: 'Welcome Vendor! You can access this API.',
    user: {
      id: request.user.sub,
      email: request.user.email,
      role: request.user.role,
    },
  };
}


// Admin Login

@Post('admin/login')
@HttpCode(HttpStatus.OK)
adminLogin(@Body() loginDto: LoginDto) {
  return this.authService.adminLogin(loginDto);
}

// ADMIN REFRESH TOKEN
@Post('admin/refresh')
@HttpCode(HttpStatus.OK)
refreshAdminToken(@Body() dto: RefreshTokenDto) {
  return this.authService.refreshAdminToken(dto);
}

// ADMIN LOGOUT
@Post('admin/logout')
@HttpCode(HttpStatus.OK)
adminLogout(@Body() dto: RefreshTokenDto) {
  return this.authService.adminLogout(dto);
}

}


