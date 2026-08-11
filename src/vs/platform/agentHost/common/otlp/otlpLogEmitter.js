import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { AbstractMessageLogger, format, LogLevel } from "../../../log/common/log.js";
const OTLP_LOGS_CHANNEL_TEMPLATE = "ahp-otlp://logs/{level}";
const OTLP_CHANNEL_SCHEME = "ahp-otlp";
const OTLP_LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"];
function levelToSeverityNumber(level) {
  switch (level) {
    case "trace":
      return 1;
    case "debug":
      return 5;
    case "info":
      return 9;
    case "warn":
      return 13;
    case "error":
      return 17;
    case "fatal":
      return 21;
  }
}
function parseOtlpLogLevel(value) {
  const lower = value.toLowerCase();
  return OTLP_LOG_LEVELS.includes(lower) ? lower : void 0;
}
function logLevelToOtlpSeverity(level) {
  switch (level) {
    case LogLevel.Trace:
      return { severityNumber: 1, severityText: "trace" };
    case LogLevel.Debug:
      return { severityNumber: 5, severityText: "debug" };
    case LogLevel.Info:
      return { severityNumber: 9, severityText: "info" };
    case LogLevel.Warning:
      return { severityNumber: 13, severityText: "warn" };
    case LogLevel.Error:
      return { severityNumber: 17, severityText: "error" };
    case LogLevel.Off:
      return { severityNumber: 0, severityText: "trace" };
  }
}
function logLevelToOtlpLevelName(level) {
  if (level === LogLevel.Off) {
    return void 0;
  }
  return logLevelToOtlpSeverity(level).severityText;
}
function severityNumberToLogLevel(severityNumber) {
  if (severityNumber >= 17) {
    return LogLevel.Error;
  }
  if (severityNumber >= 13) {
    return LogLevel.Warning;
  }
  if (severityNumber >= 9) {
    return LogLevel.Info;
  }
  if (severityNumber >= 5) {
    return LogLevel.Debug;
  }
  return LogLevel.Trace;
}
class OtelData {
  constructor(attributes) {
    this.attributes = attributes;
  }
  toJSON() {
    return this.attributes;
  }
}
class OtlpLogEmitter extends Disposable {
  constructor() {
    super(...arguments);
    this._onDidLog = this._register(new Emitter());
    this.onDidLog = this._onDidLog.event;
  }
  emit(record) {
    this._onDidLog.fire(record);
  }
}
class OtlpEmitterLogger extends AbstractMessageLogger {
  constructor(_emitter, initialLevel = LogLevel.Trace) {
    super();
    this._emitter = _emitter;
    this.setLevel(initialLevel);
  }
  trace(message, ...args) {
    if (this.canLog(LogLevel.Trace)) {
      this._emit(LogLevel.Trace, message, args, true);
    }
  }
  debug(message, ...args) {
    if (this.canLog(LogLevel.Debug)) {
      this._emit(LogLevel.Debug, message, args);
    }
  }
  info(message, ...args) {
    if (this.canLog(LogLevel.Info)) {
      this._emit(LogLevel.Info, message, args);
    }
  }
  warn(message, ...args) {
    if (this.canLog(LogLevel.Warning)) {
      this._emit(LogLevel.Warning, message, args);
    }
  }
  error(message, ...args) {
    if (this.canLog(LogLevel.Error)) {
      const head = message instanceof Error ? message.stack ?? message.message : message;
      this._emit(LogLevel.Error, head, args);
    }
  }
  log(level, message) {
    if (level === LogLevel.Off) {
      return;
    }
    this._emit(level, message, []);
  }
  /**
   * Formats `message` + `args` into the OTLP record body, lifting any
   * {@link OtelData} argument out into structured `attributes` so the
   * metadata is emitted over the channel rather than serialised into the
   * body. Mirrors the formatting the base `AbstractMessageLogger` would
   * apply (including the verbose flag for `trace`).
   */
  _emit(level, message, args, verbose = false) {
    let attributes;
    const index = args.findIndex((arg) => arg instanceof OtelData);
    if (index !== -1) {
      attributes = args[index].attributes;
      args = args.slice(0, index).concat(args.slice(index + 1));
    }
    const { severityNumber, severityText } = logLevelToOtlpSeverity(level);
    this._emitter.emit({
      timeUnixNano: msToUnixNano(Date.now()),
      severityNumber,
      severityText,
      body: format([message, ...args], verbose),
      ...attributes ? { attributes } : void 0
    });
  }
}
function toResourceLogsPayload(record) {
  return toResourceLogsPayloadBatch([record]);
}
function toResourceLogsPayloadBatch(records) {
  return {
    resourceLogs: [
      {
        resource: { attributes: [] },
        scopeLogs: [
          {
            scope: { name: "vscode.agentHost" },
            logRecords: records.map((r) => ({
              timeUnixNano: r.timeUnixNano,
              observedTimeUnixNano: r.timeUnixNano,
              severityNumber: r.severityNumber,
              severityText: r.severityText,
              body: { stringValue: r.body },
              ...r.attributes ? { attributes: attributesToOtlp(r.attributes) } : void 0
            }))
          }
        ]
      }
    ]
  };
}
function* iterateOtlpLogRecords(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }
  const resourceLogs = payload.resourceLogs;
  if (!Array.isArray(resourceLogs)) {
    return;
  }
  for (const resourceLog of resourceLogs) {
    if (!resourceLog || typeof resourceLog !== "object") {
      continue;
    }
    const scopeLogs = resourceLog.scopeLogs;
    if (!Array.isArray(scopeLogs)) {
      continue;
    }
    for (const scopeLog of scopeLogs) {
      if (!scopeLog || typeof scopeLog !== "object") {
        continue;
      }
      const logRecords = scopeLog.logRecords;
      if (!Array.isArray(logRecords)) {
        continue;
      }
      for (const raw of logRecords) {
        const record = coerceLogRecord(raw);
        if (record) {
          yield record;
        }
      }
    }
  }
}
function coerceLogRecord(raw) {
  if (!raw || typeof raw !== "object") {
    return void 0;
  }
  const r = raw;
  const severityNumber = typeof r.severityNumber === "number" ? r.severityNumber : 0;
  const severityTextRaw = typeof r.severityText === "string" ? r.severityText.toLowerCase() : "";
  const severityText = parseOtlpLogLevel(severityTextRaw) ?? severityNameFromNumber(severityNumber);
  const timeUnixNano = typeof r.timeUnixNano === "string" ? r.timeUnixNano : typeof r.observedTimeUnixNano === "string" ? r.observedTimeUnixNano : "0";
  const body = extractBody(r.body);
  const attributes = otlpToAttributes(r.attributes);
  return attributes ? { timeUnixNano, severityNumber, severityText, body, attributes } : { timeUnixNano, severityNumber, severityText, body };
}
function attributesToOtlp(attributes) {
  return Object.entries(attributes).map(([key, value]) => ({ key, value: toAnyValue(value) }));
}
function toAnyValue(value) {
  switch (typeof value) {
    case "boolean":
      return { boolValue: value };
    case "number":
      return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
    default:
      return { stringValue: value };
  }
}
function otlpToAttributes(raw) {
  if (!Array.isArray(raw)) {
    return void 0;
  }
  const result = {};
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const key = entry.key;
    if (typeof key !== "string") {
      continue;
    }
    const value = fromAnyValue(entry.value);
    if (value !== void 0) {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : void 0;
}
function fromAnyValue(value) {
  if (!value || typeof value !== "object") {
    return void 0;
  }
  const v = value;
  if (typeof v.stringValue === "string") {
    return v.stringValue;
  }
  if (typeof v.boolValue === "boolean") {
    return v.boolValue;
  }
  if (typeof v.intValue === "number") {
    return Number.isSafeInteger(v.intValue) ? v.intValue : void 0;
  }
  if (typeof v.intValue === "string") {
    const parsed = Number(v.intValue);
    return Number.isSafeInteger(parsed) ? parsed : void 0;
  }
  if (typeof v.doubleValue === "number") {
    return Number.isFinite(v.doubleValue) ? v.doubleValue : void 0;
  }
  return void 0;
}
function severityNameFromNumber(n) {
  if (n >= 21) {
    return "fatal";
  }
  if (n >= 17) {
    return "error";
  }
  if (n >= 13) {
    return "warn";
  }
  if (n >= 9) {
    return "info";
  }
  if (n >= 5) {
    return "debug";
  }
  return "trace";
}
function extractBody(body) {
  if (typeof body === "string") {
    return body;
  }
  if (body && typeof body === "object") {
    const value = body.stringValue;
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}
function msToUnixNano(ms) {
  return `${ms}000000`;
}
function extractLevelFromOtlpLogsUri(uri) {
  const match = /^ahp-otlp:\/\/logs\/([^/?#]+)/i.exec(uri);
  if (!match) {
    return void 0;
  }
  return parseOtlpLogLevel(match[1]);
}
function buildOtlpLogsChannelUri(level) {
  return `ahp-otlp://logs/${level}`;
}
export {
  OTLP_CHANNEL_SCHEME,
  OTLP_LOGS_CHANNEL_TEMPLATE,
  OTLP_LOG_LEVELS,
  OtelData,
  OtlpEmitterLogger,
  OtlpLogEmitter,
  buildOtlpLogsChannelUri,
  extractLevelFromOtlpLogsUri,
  iterateOtlpLogRecords,
  levelToSeverityNumber,
  logLevelToOtlpLevelName,
  logLevelToOtlpSeverity,
  parseOtlpLogLevel,
  severityNumberToLogLevel,
  toResourceLogsPayload,
  toResourceLogsPayloadBatch
};
