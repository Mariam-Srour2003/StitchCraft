/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { encodeGrid } from '@stitchcraft/types';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@stitchcraft.dev';
  const passwordHash = await bcrypt.hash('demo-password-123', 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: 'Demo Stitcher' },
  });

  const project = await prisma.project.upsert({
    where: { id: 'seed-project-1' },
    update: {},
    create: { id: 'seed-project-1', userId: user.id, name: 'My First Sampler' },
  });

  const width = 20;
  const height = 20;
  const blankGrid = encodeGrid(Array.from({ length: height }, () => new Array(width).fill(null)));

  await prisma.pattern.upsert({
    where: { id: 'seed-pattern-1' },
    update: {},
    create: {
      id: 'seed-pattern-1',
      projectId: project.id,
      name: 'Blank sampler',
      type: 'cross_stitch',
      width,
      height,
      palette: [],
      grid: blankGrid,
      meta: { createdFrom: 'blank', fabricCount: 14 },
    },
  });

  console.log(`Seeded demo user "${email}" (password: demo-password-123) with 1 project and 1 pattern.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
