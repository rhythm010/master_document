import { PrismaClient, CompanionRole, AdminRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.bookingAuditLog.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.penalty.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.companion.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.client.deleteMany();
  await prisma.admin.deleteMany();

  await prisma.venue.createMany({
    data: [
      {
        name: 'Dubai Mall',
        type: 'MALL',
        address: 'Financial Centre Rd, Downtown Dubai',
        latitude: 25.1972,
        longitude: 55.2796,
        country: 'AE',
        operatingHoursStart: '10:00',
        operatingHoursEnd: '00:00',
      },
      {
        name: 'Mall of the Emirates',
        type: 'MALL',
        address: 'Sheikh Zayed Rd, Al Barsha',
        latitude: 25.1180,
        longitude: 55.2000,
        country: 'AE',
        operatingHoursStart: '10:00',
        operatingHoursEnd: '00:00',
      },
      {
        name: 'Nobu Dubai',
        type: 'RESTAURANT',
        address: 'Atlantis The Palm',
        latitude: 25.1304,
        longitude: 55.1170,
        country: 'AE',
        operatingHoursStart: '12:00',
        operatingHoursEnd: '23:00',
      },
      {
        name: 'Zuma Dubai',
        type: 'RESTAURANT',
        address: 'DIFC, Dubai',
        latitude: 25.2128,
        longitude: 55.2795,
        country: 'AE',
        operatingHoursStart: '12:00',
        operatingHoursEnd: '23:00',
      },
      {
        name: 'White Dubai',
        type: 'CLUB',
        address: 'Meydan Racecourse',
        latitude: 25.1675,
        longitude: 55.2990,
        country: 'AE',
        operatingHoursStart: '20:00',
        operatingHoursEnd: '00:00',
      },
    ],
  });

  const companions = [];
  for (let i = 0; i < 5; i += 1) {
    companions.push({
      fullName: `Captain ${i + 1}`,
      phoneNumber: `+97150000${100 + i}`,
      role: CompanionRole.CAPTAIN,
      isActive: true,
      backgroundVerified: true,
      languageSkills: { en: true, ar: true },
    });
  }
  for (let i = 0; i < 5; i += 1) {
    companions.push({
      fullName: `Vice Captain ${i + 1}`,
      phoneNumber: `+97150000${200 + i}`,
      role: CompanionRole.VICE_CAPTAIN,
      isActive: true,
      backgroundVerified: true,
      languageSkills: { en: true, ar: true },
    });
  }

  const createdCompanions = await prisma.$transaction(
    companions.map((companion) => prisma.companion.create({ data: companion })),
  );

  const shifts = [] as Array<{
    companionId: string;
    date: Date;
    startTime: string;
    endTime: string;
    status: 'SCHEDULED';
  }>;

  createdCompanions.forEach((companion, index) => {
    const dayOffset = (index % 7) + 1;
    const secondOffset = dayOffset + 7;
    const shiftDates = [dayOffset, secondOffset];
    shiftDates.forEach((offset, idx) => {
      const date = dayjs().add(offset, 'day').startOf('day').toDate();
      const startTime = idx % 2 === 0 ? '09:00' : '15:00';
      const endTime = idx % 2 === 0 ? '15:00' : '21:00';
      shifts.push({
        companionId: companion.id,
        date,
        startTime,
        endTime,
        status: 'SCHEDULED',
      });
    });
  });

  await prisma.shift.createMany({ data: shifts });

  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.admin.create({
    data: {
      name: 'Super Admin',
      email: 'admin@companion.ae',
      password: adminPassword,
      role: AdminRole.SUPER_ADMIN,
      permissions: ['ALL'],
    },
  });

  await prisma.client.createMany({
    data: [
      {
        fullName: 'Test Client 1',
        nickname: 'Client1',
        phoneNumber: '+971501111111',
      },
      {
        fullName: 'Test Client 2',
        nickname: 'Client2',
        phoneNumber: '+971502222222',
      },
      {
        fullName: 'Test Client 3',
        nickname: 'Client3',
        phoneNumber: '+971503333333',
      },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
