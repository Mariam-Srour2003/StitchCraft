import type { User as PrismaUser } from '@prisma/client';

import type { User } from '@hobbygrid/types';

export function toUserDto(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}
