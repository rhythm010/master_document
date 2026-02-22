"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const pino_http_1 = __importDefault(require("pino-http"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../config/logger");
exports.requestLogger = (0, pino_http_1.default)({
    logger: logger_1.logger,
    genReqId: (req, res) => {
        const requestId = req.headers['x-request-id'] || crypto_1.default.randomUUID();
        res.setHeader('X-Request-Id', requestId);
        return requestId;
    },
    customProps: (req) => {
        const request = req;
        return {
            userId: request.user?.id,
            role: request.user?.role,
        };
    },
});
