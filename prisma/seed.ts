import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('admin123', 10);

  const adminEmail = 'admin@admin.com'; // igual al email del login
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'SUPERADMIN', name: 'Super Admin', password: hashed },
    create: { name: 'Super Admin', email: adminEmail, password: hashed, role: 'SUPERADMIN' },
  });
}

main().catch(e => console.error(e));
