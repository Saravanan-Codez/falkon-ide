import { localize } from "../../../../../nls.js";
const DAYS_OF_WEEK = [
  localize("automation.day.sun", "Sunday"),
  localize("automation.day.mon", "Monday"),
  localize("automation.day.tue", "Tuesday"),
  localize("automation.day.wed", "Wednesday"),
  localize("automation.day.thu", "Thursday"),
  localize("automation.day.fri", "Friday"),
  localize("automation.day.sat", "Saturday")
];
function computeNextRunAt(schedule, now) {
  const { interval, scheduleHour, scheduleMinute, scheduleDay } = schedule;
  switch (interval) {
    case "manual":
      return void 0;
    case "hourly":
      return new Date(now.getTime() + 60 * 60 * 1e3);
    case "daily": {
      if (!isValidHourMinute(scheduleHour, scheduleMinute)) {
        return void 0;
      }
      const today = buildLocalDate(now.getFullYear(), now.getMonth(), now.getDate(), scheduleHour, scheduleMinute);
      if (today.getTime() > now.getTime()) {
        return today;
      }
      return buildLocalDate(now.getFullYear(), now.getMonth(), now.getDate() + 1, scheduleHour, scheduleMinute);
    }
    case "weekly": {
      if (!isValidHourMinute(scheduleHour, scheduleMinute)) {
        return void 0;
      }
      if (!Number.isInteger(scheduleDay) || scheduleDay < 0 || scheduleDay > 6) {
        return void 0;
      }
      const currentDay = now.getDay();
      let daysAhead = scheduleDay - currentDay;
      const sameDayButPassed = daysAhead === 0 && (now.getHours() > scheduleHour || now.getHours() === scheduleHour && now.getMinutes() >= scheduleMinute);
      if (daysAhead < 0 || sameDayButPassed) {
        daysAhead += 7;
      }
      return buildLocalDate(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead, scheduleHour, scheduleMinute);
    }
    default:
      return void 0;
  }
}
function isValidHourMinute(hour, minute) {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 && Number.isInteger(minute) && minute >= 0 && minute <= 59;
}
function buildLocalDate(year, monthIndex, day, hour, minute) {
  const candidate = new Date(year, monthIndex, day, hour, minute, 0, 0);
  if (candidate.getHours() === hour && candidate.getMinutes() === minute) {
    return candidate;
  }
  for (let shift = 1; shift <= 3; shift++) {
    const shifted = new Date(year, monthIndex, day, hour + shift, minute, 0, 0);
    if (shifted.getHours() === (hour + shift) % 24 && shifted.getMinutes() === minute) {
      return shifted;
    }
  }
  return candidate;
}
export {
  DAYS_OF_WEEK,
  computeNextRunAt
};
