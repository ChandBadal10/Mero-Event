
import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,

  ) {}

  // register
  async registerVendor(dto: VendorRegisterDto) {

    const email = dto.email.trim().toLowerCase();

    //  Check if the email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    //  Hash the password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    //  Create user and vendor
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

      //  Return success response
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


  // refrest token
  async refreshVendorToken(dto: RefreshTokenDto) {
  // Verify the refresh token
  let payload: {
    sub: string;
    email: string;
    role: string;
  };

  try {
    payload = await this.jwtService.verifyAsync(dto.refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });
  } catch {
    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  // Find the user in the database
  const user = await this.prisma.user.findUnique({
    where: {
      id: payload.sub,
    },
    include: {
      vendor: true,
    },
  });

  if (!user) {
    throw new UnauthorizedException('User not found');
  }

  //  Check account role and status
  if (user.role !== 'VENDOR') {
    throw new UnauthorizedException('Invalid vendor account');
  }

  if (!user.isActive || !user.vendor || user.vendor.status !== 'ACTIVE') {
    throw new UnauthorizedException('Vendor account is not active');
  }

  // Check whether a refresh token exists in the database
  if (!user.refreshTokenHash) {
    throw new UnauthorizedException('Please log in again');
  }

  //  Compare the received refresh token with its stored hash
  const isRefreshTokenValid = await bcrypt.compare(
    dto.refreshToken,
    user.refreshTokenHash,
  );

  if (!isRefreshTokenValid) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  //  Create a new JWT payload
  const newPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  //  Generate a new access token
  const accessToken = await this.jwtService.signAsync(newPayload, {
    secret: process.env.JWT_ACCESS_SECRET,
    expiresIn: '15m',
  });

  //  Generate a new refresh token
  const refreshToken = await this.jwtService.signAsync(newPayload, {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d',
  });

  // Hash the new refresh token
  const newRefreshTokenHash = await bcrypt.hash(refreshToken, 10);

  //  Replace the old refresh token hash
  await this.prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      refreshTokenHash: newRefreshTokenHash,
    },
  });

  //  Return the new tokens
  return {
    message: 'Access token refreshed successfully',

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


  //Logout
  async vendorLogout(dto: RefreshTokenDto) {
  // Verify refresh token signature
  let payload: {
    sub: string;
    email: string;
    role: string;
  };

  try {
    payload = await this.jwtService.verifyAsync(dto.refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
      ignoreExpiration: true,
    });
  } catch {
    throw new UnauthorizedException('Invalid refresh token');
  }

  //  Find the user
  const user = await this.prisma.user.findUnique({
    where: {
      id: payload.sub,
    },
  });

  if (!user || user.role !== 'VENDOR') {
    throw new UnauthorizedException('Invalid vendor session');
  }

  //  Check whether a refresh token is stored
  if (!user.refreshTokenHash) {
    throw new UnauthorizedException('You are already logged out');
  }

  //  Compare the received token with the stored hash
  const isTokenValid = await bcrypt.compare(
    dto.refreshToken,
    user.refreshTokenHash,
  );

  if (!isTokenValid) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  //  Remove the refresh token hash
  await this.prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      refreshTokenHash: null,
    },
  });

  return {
    message: 'Vendor logged out successfully',
  };
}


  // Admin Login
  async adminLogin(loginDto: LoginDto) {
  const email = loginDto.email.trim().toLowerCase();

  //  Find Admin account
  const user = await this.prisma.user.findUnique({
    where: { email },
  });

  //  Check account and password
  if (!user || user.role !== 'ADMIN') {
    throw new UnauthorizedException(
      'Invalid email or password',
    );
  }

  const isPasswordValid = await bcrypt.compare(
    loginDto.password,
    user.passwordHash,
  );

  if (!isPasswordValid) {
    throw new UnauthorizedException(
      'Invalid email or password',
    );
  }

  //  Check whether Admin account is active
  if (!user.isActive) {
    throw new ForbiddenException(
      'Your Admin account is inactive.',
    );
  }

  //  Create JWT payload
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  //  Generate access token
  const accessToken = await this.jwtService.signAsync(
    payload,
    {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    },
  );

  //  Generate refresh token
  const refreshToken = await this.jwtService.signAsync(
    payload,
    {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    },
  );

  //  Hash refresh token and save in database
  const refreshTokenHash = await bcrypt.hash(
    refreshToken,
    10,
  );

  await this.prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash },
  });

  //  Return tokens and safe user information
  return {
    message: 'Admin logged in successfully',

    accessToken,
    refreshToken,

    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  };
}


  // Admin refresh token
  async refreshAdminToken(dto: RefreshTokenDto) {
  try {
    //  Verify refresh token
    const payload = await this.jwtService.verifyAsync(
      dto.refreshToken,
      {
        secret: process.env.JWT_REFRESH_SECRET,
      },
    );

    //  Find Admin
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (
      !user ||
      user.role !== 'ADMIN' ||
      !user.isActive ||
      !user.refreshTokenHash
    ) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    //  Compare token with stored hash
    const isTokenValid = await bcrypt.compare(
      dto.refreshToken,
      user.refreshTokenHash,
    );

    if (!isTokenValid) {
      throw new UnauthorizedException(
        'Refresh token is invalid or already used',
      );
    }

    //  Create new payload
    const newPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    //  Generate new tokens
    const accessToken = await this.jwtService.signAsync(
      newPayload,
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      newPayload,
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    //  Save new refresh token hash
    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      10,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      message: 'Admin tokens refreshed successfully',
      accessToken,
      refreshToken,
    };
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      throw error;
    }

    throw new UnauthorizedException(
      'Invalid or expired refresh token',
    );
  }
}

  //  Admin logout
  async adminLogout(dto: RefreshTokenDto) {
  try {
    //  Verify refresh token
    const payload = await this.jwtService.verifyAsync(
      dto.refreshToken,
      {
        secret: process.env.JWT_REFRESH_SECRET,
        ignoreExpiration: true,
      },
    );

    //  Find Admin
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (
      !user ||
      user.role !== 'ADMIN' ||
      !user.refreshTokenHash
    ) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    //  Compare refresh token
    const isTokenValid = await bcrypt.compare(
      dto.refreshToken,
      user.refreshTokenHash,
    );

    if (!isTokenValid) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    //  Invalidate refresh token
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: null },
    });

    return {
      message: 'Admin logged out successfully',
    };
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      throw error;
    }

    throw new UnauthorizedException(
      'Invalid refresh token',
    );
  }
}

}
