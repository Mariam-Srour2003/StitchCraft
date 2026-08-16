import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwt: JwtService;

  const secrets: Record<string, string> = {
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
  };
  const config = {
    getOrThrow: (key: string) => secrets[key],
  } as unknown as ConfigService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = new JwtService();
    service = new AuthService(prisma as unknown as PrismaService, jwt, config);
  });

  describe('register', () => {
    it('creates a user with a bcrypt-hashed password and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        name: 'Ada',
        createdAt: new Date('2026-01-01'),
      });
      prisma.user.update.mockResolvedValueOnce({});

      const result = await service.register({ email: 'a@b.com', password: 'password123', name: 'Ada' });

      expect(result.user).toEqual({ id: 'user-1', email: 'a@b.com', name: 'Ada', createdAt: '2026-01-01T00:00:00.000Z' });
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', createArgs.data.passwordHash)).toBe(true);
    });

    it('rejects registration when the email is already taken', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' });

      await expect(
        service.register({ email: 'a@b.com', password: 'password123', name: 'Ada' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.login({ email: 'nope@b.com', password: 'x' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an incorrect password', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: await bcrypt.hash('correct-password', 4),
      });

      await expect(service.login({ email: 'a@b.com', password: 'wrong-password' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('issues tokens on a correct password', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        name: 'Ada',
        passwordHash: await bcrypt.hash('correct-password', 4),
        createdAt: new Date('2026-01-01'),
      });
      prisma.user.update.mockResolvedValueOnce({});

      const result = await service.login({ email: 'a@b.com', password: 'correct-password' });
      expect(result.accessToken).toEqual(expect.any(String));
    });
  });

  describe('refresh', () => {
    it('rejects a refresh token that fails verification', async () => {
      await expect(service.refresh('not-a-real-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a syntactically valid token whose hash no longer matches (revoked)', async () => {
      const refreshToken = await jwt.signAsync(
        { sub: 'user-1', email: 'a@b.com' },
        { secret: secrets.JWT_REFRESH_SECRET, expiresIn: '7d' },
      );
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        refreshTokenHash: await bcrypt.hash('a-different-refresh-token', 4),
      });

      await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues a new token pair for a valid, non-revoked refresh token', async () => {
      const refreshToken = await jwt.signAsync(
        { sub: 'user-1', email: 'a@b.com' },
        { secret: secrets.JWT_REFRESH_SECRET, expiresIn: '7d' },
      );
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        refreshTokenHash: await bcrypt.hash(refreshToken, 4),
      });
      prisma.user.update.mockResolvedValueOnce({});

      const result = await service.refresh(refreshToken);
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
    });
  });
});
