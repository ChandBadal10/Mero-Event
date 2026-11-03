
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

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


}


