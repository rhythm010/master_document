"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const errors_1 = require("../shared/errors");
const logger_1 = require("../config/logger");
function errorHandler(err, req, res, _next) {
    if (err instanceof errors_1.AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                details: err.details ?? undefined,
                data: err.data ?? undefined,
            },
        });
    }
    if (err?.code === 'P2002') {
        return res.status(409).json({
            success: false,
            error: { code: 'DUPLICATE_ENTRY', message: 'Resource already exists' },
        });
    }
    logger_1.logger.error({ err, requestId: req.id }, 'Unhandled error');
    return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
}
