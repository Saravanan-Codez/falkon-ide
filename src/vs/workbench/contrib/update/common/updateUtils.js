import { localize } from "../../../../nls.js";
function computeProgressPercent(current, max) {
  if (current === void 0 || max === void 0 || max <= 0) {
    return void 0;
  }
  return Math.max(Math.min(Math.round(current / max * 100), 100), 0);
}
function computeDownloadTimeRemaining(state) {
  const { downloadedBytes, totalBytes, startTime } = state;
  if (downloadedBytes === void 0 || totalBytes === void 0 || startTime === void 0) {
    return void 0;
  }
  const elapsedMs = Date.now() - startTime;
  if (downloadedBytes <= 0 || totalBytes <= 0 || elapsedMs <= 0) {
    return void 0;
  }
  const remainingBytes = totalBytes - downloadedBytes;
  if (remainingBytes <= 0) {
    return 0;
  }
  const bytesPerMs = downloadedBytes / elapsedMs;
  if (bytesPerMs <= 0) {
    return void 0;
  }
  const remainingMs = remainingBytes / bytesPerMs;
  return Math.ceil(remainingMs / 1e3);
}
function computeDownloadSpeed(state) {
  const { downloadedBytes, startTime } = state;
  if (downloadedBytes === void 0 || startTime === void 0) {
    return void 0;
  }
  const elapsedMs = Date.now() - startTime;
  if (elapsedMs <= 0 || downloadedBytes <= 0) {
    return void 0;
  }
  return downloadedBytes / elapsedMs * 1e3;
}
function computeUpdateInfoVersion(currentVersion, targetVersion) {
  const current = tryParseVersion(currentVersion);
  const target = tryParseVersion(targetVersion);
  if (!current || !target) {
    return void 0;
  }
  if (current.minor !== target.minor || current.major !== target.major) {
    return `${target.major}.${target.minor}`;
  }
  return `${target.major}.${target.minor}.${target.patch}`;
}
function getUpdateInfoUrl(version) {
  const versionLabel = version.replace(/\./g, "_").replace(/_0$/, "");
  return `https://code.visualstudio.com/raw/v${versionLabel}_update.md`;
}
function formatTimeRemaining(seconds) {
  const hours = seconds / 3600;
  if (hours >= 1) {
    const formattedHours = formatDecimal(hours);
    if (formattedHours === "1") {
      return localize("update.timeRemainingHour", "{0} hour", formattedHours);
    } else {
      return localize("update.timeRemainingHours", "{0} hours", formattedHours);
    }
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 1) {
    return localize("update.timeRemainingMinutes", "{0} min", minutes);
  }
  return localize("update.timeRemainingSeconds", "{0}s", seconds);
}
function formatBytes(bytes) {
  if (bytes < 1024) {
    return localize("update.bytes", "{0} B", bytes);
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return localize("update.kilobytes", "{0} KB", formatDecimal(kb));
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return localize("update.megabytes", "{0} MB", formatDecimal(mb));
  }
  const gb = mb / 1024;
  return localize("update.gigabytes", "{0} GB", formatDecimal(gb));
}
function tryParseDate(date) {
  if (date === void 0) {
    return void 0;
  }
  try {
    const parsed = Date.parse(date);
    return isNaN(parsed) ? void 0 : parsed;
  } catch {
    return void 0;
  }
}
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString(void 0, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
function formatDecimal(value) {
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
}
function tryParseVersion(version) {
  if (version === void 0) {
    return void 0;
  }
  const match = /^(\d{1,10})\.(\d{1,10})\.(\d{1,10})/.exec(version);
  if (!match) {
    return void 0;
  }
  try {
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3])
    };
  } catch {
    return void 0;
  }
}
function preprocessError(error) {
  if (!error) {
    return void 0;
  }
  if (/The request timed out|The network connection was lost/i.test(error)) {
    return void 0;
  }
  return error.replace(
    /See https:\/\/github\.com\/Squirrel\/Squirrel\.Mac\/issues\/182 for more information/,
    "This might mean the application was put on quarantine by macOS. See [this link](https://github.com/microsoft/vscode/issues/7426#issuecomment-425093469) for more information"
  );
}
function isMajorMinorVersionChange(previousVersion, newVersion) {
  const previous = tryParseVersion(previousVersion);
  const current = tryParseVersion(newVersion);
  return !!previous && !!current && (previous.major !== current.major || previous.minor !== current.minor);
}
export {
  computeDownloadSpeed,
  computeDownloadTimeRemaining,
  computeProgressPercent,
  computeUpdateInfoVersion,
  formatBytes,
  formatDate,
  formatDecimal,
  formatTimeRemaining,
  getUpdateInfoUrl,
  isMajorMinorVersionChange,
  preprocessError,
  tryParseDate,
  tryParseVersion
};
