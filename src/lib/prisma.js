import { PrismaClient } from '@prisma/client';

// PrismaClient singleton to prevent creating multiple instances
// This is important in development where hot-reload can create multiple instances

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // In development, use a global variable to preserve the client across hot reloads
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export default prisma;
