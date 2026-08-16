import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@stitchcraft/types';
import { PrismaService } from '../../prisma/prisma.service';
import { toUserDto } from './users.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return toUserDto(user);
  }
}
