"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
exports.created = created;
function ok(res, data, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data });
}
function created(res, data) {
    return ok(res, data, 201);
}
