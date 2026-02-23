"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestOtp = requestOtp;
exports.verifyOtp = verifyOtp;
exports.adminLogin = adminLogin;
exports.refreshToken = refreshToken;
const response_1 = require("../../shared/response");
const authService = __importStar(require("./auth.service"));
async function requestOtp(req, res) {
    const { phoneNumber } = req.validated?.body;
    const data = await authService.requestOtp(phoneNumber);
    return (0, response_1.ok)(res, data);
}
async function verifyOtp(req, res) {
    const { phoneNumber, otp } = req.validated?.body;
    const data = await authService.verifyOtp(phoneNumber, otp);
    return (0, response_1.ok)(res, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        client: {
            id: data.client.id,
            nickname: data.client.nickname,
            phoneNumber: data.client.phoneNumber,
            bookingStatusCache: data.client.bookingStatusCache,
            currentBookingId: data.client.currentBookingId,
        },
        isNewUser: data.isNewUser,
    });
}
async function adminLogin(req, res) {
    const { email, password } = req.validated?.body;
    const data = await authService.adminLogin(email, password);
    return (0, response_1.ok)(res, {
        accessToken: data.accessToken,
        admin: {
            id: data.admin.id,
            name: data.admin.name,
            role: data.admin.role,
        },
    });
}
async function refreshToken(req, res) {
    const { refreshToken } = req.validated?.body;
    const data = await authService.refreshToken(refreshToken);
    return (0, response_1.ok)(res, data);
}
