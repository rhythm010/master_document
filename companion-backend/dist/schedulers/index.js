"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSchedulers = startSchedulers;
const node_cron_1 = __importDefault(require("node-cron"));
const soft_lock_expiry_job_1 = require("./soft-lock-expiry.job");
const duo_breach_job_1 = require("./duo-breach.job");
const client_no_show_job_1 = require("./client-no-show.job");
const booking_detail_reveal_job_1 = require("./booking-detail-reveal.job");
const battery_check_job_1 = require("./battery-check.job");
const location_log_cleanup_job_1 = require("./location-log-cleanup.job");
function startSchedulers() {
    node_cron_1.default.schedule('* * * * *', soft_lock_expiry_job_1.runSoftLockExpiry);
    node_cron_1.default.schedule('* * * * *', duo_breach_job_1.runDuoBreach);
    node_cron_1.default.schedule('* * * * *', client_no_show_job_1.runClientNoShow);
    node_cron_1.default.schedule('*/5 * * * *', booking_detail_reveal_job_1.runBookingDetailReveal);
    node_cron_1.default.schedule('0 * * * *', battery_check_job_1.runBatteryCheck);
    node_cron_1.default.schedule('0 3 * * *', location_log_cleanup_job_1.runLocationLogCleanup);
}
