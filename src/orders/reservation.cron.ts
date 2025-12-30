import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export class ReservationCron {
  constructor(private prisma: PrismaService) {}

  @Cron('*/2 * * * *')
  async expireReservations() {
    // ...pegar aquí el código del job de expiración...
  }
}