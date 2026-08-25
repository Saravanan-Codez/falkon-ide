import { localize } from "../../../../nls.js";
import { fromNow, safeIntl } from "../../../../base/common/date.js";
import { language } from "../../../../base/common/platform.js";
const dayInMilliseconds = 24 * 60 * 60 * 1e3;
const chatRequestTimeFormatter = safeIntl.DateTimeFormat(language, {
  hour: "numeric",
  minute: "2-digit"
});
const chatRequestFullDateTimeFormatter = safeIntl.DateTimeFormat(language, {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});
function formatElapsedTime(ms) {
  const totalSeconds = Math.floor(ms / 1e3);
  if (totalSeconds < 60) {
    return localize("seconds", "{0}s", totalSeconds);
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return localize("minutesSeconds", "{0}m {1}s", minutes, seconds);
}
function formatChatResponseElapsedTime(elapsedMs) {
  return typeof elapsedMs === "number" && elapsedMs >= 1e3 ? formatElapsedTime(elapsedMs) : void 0;
}
function formatChatRequestTimestamp(timestamp) {
  if (timestamp === void 0 || !Number.isFinite(timestamp) || timestamp <= 0) {
    return void 0;
  }
  const date = new Date(timestamp);
  const age = Date.now() - timestamp;
  const isRelative = age > dayInMilliseconds;
  return {
    text: isRelative ? fromNow(timestamp, false, true) : chatRequestTimeFormatter.value.format(date),
    fullText: chatRequestFullDateTimeFormatter.value.format(date),
    dateTime: date.toISOString(),
    isRelative
  };
}
function formatChatResponseDetails(details, timing) {
  const parts = timing ? [timing] : [];
  if (details) {
    parts.push(details);
  }
  return parts.join(" \u2022 ");
}
export {
  formatChatRequestTimestamp,
  formatChatResponseDetails,
  formatChatResponseElapsedTime,
  formatElapsedTime
};
