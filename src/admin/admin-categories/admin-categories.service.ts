import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminCategoriesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, slug: true, parentId: true, createdAt: true, updatedAt: true },
    });
  }

  create(data: { name: string; slug: string; parentId?: number | null; description?: string | null; imageUrl?: string | null }) {
    return this.prisma.category.create({ data });
  }

  update(id: number, data: Partial<{ name: string; slug: string; parentId: number | null; description: string | null; imageUrl: string | null }>) {
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: number) {
    const exists = await this.prisma.category.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Categoría no encontrada');
    return this.prisma.category.delete({ where: { id } });
  }
}