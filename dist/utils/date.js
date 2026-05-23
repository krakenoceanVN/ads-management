"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUSINESS_TIME_ZONE = void 0;
exports.formatBusinessDate = formatBusinessDate;
exports.getBusinessDayStart = getBusinessDayStart;
exports.getBusinessDateAtHour = getBusinessDateAtHour;
exports.getBusinessDayRange = getBusinessDayRange;
exports.buildInclusiveDateRange = buildInclusiveDateRange;
exports.getBusinessDateRange = getBusinessDateRange;
exports.getBusinessMonthRange = getBusinessMonthRange;
exports.getDaysInMonth = getDaysInMonth;
exports.getDaysInRange = getDaysInRange;
exports.BUSINESS_TIME_ZONE = "Asia/Bangkok";
const BUSINESS_UTC_OFFSET_HOURS = 7;
function parseDateParts(dateStr) {
    const [year, month, day] = dateStr.split("-").map(Number);
    return [year, month, day];
}
function formatBusinessDate(date) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: exports.BUSINESS_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value ?? "0000";
    const month = parts.find((part) => part.type === "month")?.value ?? "00";
    const day = parts.find((part) => part.type === "day")?.value ?? "00";
    return `${year}-${month}-${day}`;
}
function getBusinessDayStart(dateStr) {
    const [year, month, day] = parseDateParts(dateStr);
    return new Date(Date.UTC(year, month - 1, day, -BUSINESS_UTC_OFFSET_HOURS, 0, 0));
}
function getBusinessDateAtHour(dateStr, hour) {
    const [year, month, day] = parseDateParts(dateStr);
    return new Date(Date.UTC(year, month - 1, day, hour - BUSINESS_UTC_OFFSET_HOURS, 0, 0));
}
function getBusinessDayRange(dateStr) {
    const [year, month, day] = parseDateParts(dateStr);
    return {
        gte: getBusinessDayStart(dateStr),
        lt: new Date(Date.UTC(year, month - 1, day + 1, -BUSINESS_UTC_OFFSET_HOURS, 0, 0)),
    };
}
/**
 * Build a half-open date range [gte, lt) for a user-facing inclusive date range.
 * e.g. startDate=2026-01-01, endDate=2026-01-31 → gte=2026-01-01 00:00, lt=2026-02-01 00:00
 * This avoids midnight time-of-day bugs when endDate is stored as midnight.
 */
function buildInclusiveDateRange(startDateStr, endDateStr) {
    return {
        gte: getBusinessDayStart(startDateStr),
        lt: new Date(getBusinessDayStart(endDateStr).getTime() + 24 * 60 * 60 * 1000),
    };
}
function getBusinessDateRange(startDateStr, endDateStr) {
    return buildInclusiveDateRange(startDateStr, endDateStr);
}
function getBusinessMonthRange(year, month) {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
    return {
        gte: getBusinessDayStart(startDate),
        lt: getBusinessDayStart(nextMonthDate),
    };
}
function getDaysInMonth(year, month) {
    const days = [];
    const date = new Date(Date.UTC(year, month - 1, 1));
    while (date.getUTCMonth() === month - 1) {
        const dayStr = String(date.getUTCDate()).padStart(2, "0");
        days.push(`${year}-${String(month).padStart(2, "0")}-${dayStr}`);
        date.setUTCDate(date.getUTCDate() + 1);
    }
    return days;
}
function getDaysInRange(gte, lt) {
    const days = [];
    const date = new Date(gte);
    while (date < lt) {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        const dayStr = String(day).padStart(2, "0");
        days.push(`${year}-${String(month).padStart(2, "0")}-${dayStr}`);
        date.setUTCDate(date.getUTCDate() + 1);
    }
    return days;
}
