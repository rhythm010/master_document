"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = authorize;
const errors_1 = require("../shared/errors");
function authorize(...allowedRoles) {
    return (req, _res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            throw new errors_1.ForbiddenError('Access denied');
        }
        next();
    };
}
