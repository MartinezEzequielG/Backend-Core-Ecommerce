import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    const [childrenCount, productsCount] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.product.count({ where: { categoryId: id } }),
    ]);

    if (childrenCount > 0) {
      throw new BadRequestException('No se puede borrar: la categoría tiene subcategorías.');
    }
    if (productsCount > 0) {
      throw new BadRequestException('No se puede borrar: la categoría está asignada a productos.');
    }

    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new BadRequestException('No se puede borrar: hay registros relacionados.');
      }
      throw e;
    }
  }
}