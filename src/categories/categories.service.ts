import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, parentId: true },
    });
  }

  async bySlug(slug: string) {
    const cat = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, parentId: true },
    });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    return cat;
  }

  async tree() {
    const categories = await this.list();
    const byParent = new Map<number | null, any[]>();
    for (const c of categories) {
      const key = (c.parentId ?? null) as number | null;
      byParent.set(key, [...(byParent.get(key) ?? []), { ...c, children: [] }]);
    }
    const attach = (nodes: any[]) =>
      nodes.map((n) => ({ ...n, children: attach(byParent.get(n.id) ?? []) }));
    return attach(byParent.get(null) ?? []);
  }
}