"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestClient = createTestClient;
exports.createTestCompanion = createTestCompanion;
exports.createTestVenue = createTestVenue;
exports.getAuthToken = getAuthToken;
exports.getAdminToken = getAdminToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../config/prisma");
const env_1 = require("../config/env");
async function createTestClient(overrides = {}) {
    return prisma_1.prisma.client.create({
        data: {
            fullName: 'Test Client',
            nickname: 'Tester',
            phoneNumber: `+97150${Math.floor(Math.random() * 10000000)}`,
            ...overrides,
        },
    });
}
async function createTestCompanion(role, overrides = {}) {
    return prisma_1.prisma.companion.create({
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
async function createTestVenue(type) {
    return prisma_1.prisma.venue.create({
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
function getAuthToken(clientId) {
    return jsonwebtoken_1.default.sign({ sub: clientId, role: 'CLIENT' }, env_1.env.JWT_SECRET, { expiresIn: '1h' });
}
function getAdminToken(adminId, role) {
    return jsonwebtoken_1.default.sign({ sub: adminId, role }, env_1.env.JWT_SECRET, { expiresIn: '8h' });
}
