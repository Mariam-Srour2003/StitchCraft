import { User as PrismaUser } from '@prisma/client';
import { User } from '@stitchcraft/types';

export function toUserDto(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}
