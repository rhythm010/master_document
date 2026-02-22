import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { CompanionRole, VenueType, Prisma } from '@prisma/client';

export async function createTestClient(overrides: Partial<Prisma.ClientCreateInput> = {}) {
  return prisma.client.create({
    data: {
      fullName: 'Test Client',
      nickname: 'Tester',
      phoneNumber: `+97150${Math.floor(Math.random() * 10000000)}`,
      ...overrides,
    },
  });
}

export async function createTestCompanion(
  role: CompanionRole,
  overrides: Partial<Prisma.CompanionCreateInput> = {},
) {
  return prisma.companion.create({
    data: {
      fullName: 'Test Companion',
      phoneNumber: `+97155${Math.floor(Math.random() * 10000000)}`,
      role,
      isActive: true,
      backgroundVerified: true,
      languageSkills: { en: true },
      ...overrides,
    },
  });
}

export async function createTestVenue(type: VenueType) {
  return prisma.venue.create({
    data: {
      name: 'Test Venue',
      type,
      address: 'Test Address',
      latitude: 25.0,
      longitude: 55.0,
      country: 'AE',
      operatingHoursStart: '10:00',
      operatingHoursEnd: '22:00',
    },
  });
}

export function getAuthToken(clientId: string) {
  return jwt.sign({ sub: clientId, role: 'CLIENT' }, env.JWT_SECRET, { expiresIn: '1h' });
}

export function getAdminToken(adminId: string, role: string) {
  return jwt.sign({ sub: adminId, role }, env.JWT_SECRET, { expiresIn: '8h' });
}
