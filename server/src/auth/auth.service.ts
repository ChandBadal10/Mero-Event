
import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,

  ) {}

  async registerVendor(dto: VendorRegisterDto) {
    // Step 1: Clean the email
    const email = dto.email.trim().toLowerCase();

    // Step 2: Check if the email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Step 3: Hash the password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Step 4: Create user and vendor
    try {
      const user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName.trim(),
          email: email,
          passwordHash: hashedPassword,
          role: 'VENDOR',

          vendor: {
            create: {
              businessName: dto.businessName.trim(),
              contactPerson: dto.contactPerson,
              phone: dto.phone,
              businessEmail: dto.businessEmail?.trim().toLowerCase(),
              address: dto.address,
              description: dto.description,
            },
          },
        },

        // Return only necessary information
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          createdAt: true,
          vendor: {
            select: {
              id: true,
              businessName: true,
              contactPerson: true,
              phone: true,
              businessEmail: true,
              address: true,
              description: true,
              status: true,
            },
          },
        },
      });

      // Step 5: Return success response
      return {
        message: 'Vendor registered successfully',
        user,
      };

    } catch (error) {
      // Handle duplicate email error
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
  }



  // login
  async vendorLogin(loginDto: LoginDto) {
  //  Find user using email
  const email = loginDto.email.trim().toLowerCase();

  const user = await this.prisma.user.findUnique({
    where: {
      email,
    },
    include: {
      vendor: true,
    },
  });

  //  Check whether user exists
  if (!user) {
    throw new UnauthorizedException('Invalid email or password');
  }

  // Compare submitted password with stored password hash
  const isPasswordValid = await bcrypt.compare(
    loginDto.password,
    user.passwordHash,
  );

  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid email or password');
  }

  // Check account role
  if (user.role !== 'VENDOR') {
    throw new ForbiddenException(
      'This login is only for vendor accounts',
    );
  }

  // Check whether account is active
  if (!user.isActive) {
    throw new ForbiddenException('Your account is inactive');
  }

  // Check whether vendor profile exists
  if (!user.vendor) {
    throw new ForbiddenException('Vendor profile not found');
  }

  // Check vendor approval status
  if (user.vendor.status !== 'ACTIVE') {
    throw new ForbiddenException(
      `Your vendor account is ${user.vendor.status}. Please contact Mero Event admin.`,
    );
  }

  //  Create JWT payload
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  //  Generate access token
  const accessToken = await this.jwtService.signAsync(payload, {
    secret: process.env.JWT_ACCESS_SECRET,
    expiresIn: '15m',
  });

  // 1 Generate refresh token
  const refreshToken = await this.jwtService.signAsync(payload, {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d',
  });

  //  Hash refresh token before storing it
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  await this.prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      refreshTokenHash,
    },
  });

  //  Return login response
  return {
    message: 'Vendor logged in successfully',

    accessToken,
    refreshToken,

    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,

      vendor: {
        id: user.vendor.id,
        businessName: user.vendor.businessName,
        status: user.vendor.status,
      },
    },
  };
}


}
