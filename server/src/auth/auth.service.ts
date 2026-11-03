
import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { VendorRegisterDto } from './dto/vendor-register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
}
