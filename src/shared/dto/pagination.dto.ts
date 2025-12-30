export class PaginationDto {
  page?: number = 1;
  limit?: number = 20;
}

export function toPagination({ page = 1, limit = 20 }: PaginationDto) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const p = Math.max(Number(page) || 1, 1);
  const skip = (p - 1) * take;
  return { skip, take, page: p, limit: take };
}

export function parseSort(sort?: string) {
  if (!sort) return undefined as undefined | Record<string, 'asc' | 'desc'>;
  const [field, dir] = sort.split(':');
  return { [field]: dir?.toLowerCase() === 'desc' ? 'desc' : 'asc' } as Record<string, 'asc' | 'desc'>;
}