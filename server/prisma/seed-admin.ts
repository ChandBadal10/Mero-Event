
import 'dotenv/config';

import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../src/prisma/prisma.service';

async function createAdmin() {
  const prisma = new PrismaService();

  try {
    const fullName = process.env.ADMIN_FULL_NAME;
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!fullName || !email || !password) {
      throw new Error(
        'ADMIN_FULL_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required.',
      );
    }

    if (password.length < 12) {
      throw new Error(
        'Admin password must contain at least 12 characters.',
      );
    }

    await prisma.$connect();

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error(
        'This email already exists. No Admin account was created.',
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    console.log('Admin account created successfully!');
    console.log(admin);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin().catch((error) => {
  console.error('Admin setup failed:', error);
  process.exitCode = 1;
});
