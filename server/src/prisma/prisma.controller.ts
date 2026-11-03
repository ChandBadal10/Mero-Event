import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('health')
export class PrismaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('database')
  async checkDatabase() {
    const result = await this.prisma.$queryRaw<
      Array<{ current_time: Date }>
    >`SELECT NOW() AS current_time`;

    return {
      status: 'success',
      message: 'Neon PostgreSQL connection is working!',
      databaseTime: result[0]?.current_time,
    };
  }
}