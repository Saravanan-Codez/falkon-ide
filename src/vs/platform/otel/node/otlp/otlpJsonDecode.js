import { SpanStatusCode } from "../../common/spanData.js";
import {
  OtlpStatusCode
} from "./otlpJsonTypes.js";
const HEX_RE = /^[0-9a-fA-F]+$/;
const ALL_ZERO_TRACE_ID = "00000000000000000000000000000000";
const ALL_ZERO_SPAN_ID = "0000000000000000";
function decodeExportTraceRequest(request) {
  if (!request || !Array.isArray(request.resourceSpans)) {
    return { spans: [], rejected: 0, errors: [] };
  }
  const spans = [];
  const errors = [];
  let rejected = 0;
  for (const rs of request.resourceSpans) {
    if (!rs) {
      continue;
    }
    const resourceAttrs = decodeAttributes(rs.resource?.attributes);
    for (const ss of rs.scopeSpans ?? []) {
      if (!ss) {
        continue;
      }
      for (const span of ss.spans ?? []) {
        try {
          const decoded = decodeSpan(span, resourceAttrs);
          if (decoded) {
            spans.push(decoded);
          } else {
            rejected++;
          }
        } catch (e) {
          rejected++;
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }
    }
  }
  return { spans, rejected, errors };
}
function decodeSpan(span, resourceAttrs) {
  if (!span) {
    return void 0;
  }
  const traceId = (span.traceId ?? "").toLowerCase();
  const spanId = (span.spanId ?? "").toLowerCase();
  if (!isValidHex(traceId, 32) || traceId === ALL_ZERO_TRACE_ID) {
    throw new Error(`invalid traceId: ${span.traceId}`);
  }
  if (!isValidHex(spanId, 16) || spanId === ALL_ZERO_SPAN_ID) {
    throw new Error(`invalid spanId: ${span.spanId}`);
  }
  let parentSpanId;
  if (span.parentSpanId) {
    const ps = span.parentSpanId.toLowerCase();
    if (isValidHex(ps, 16) && ps !== ALL_ZERO_SPAN_ID) {
      parentSpanId = ps;
    }
  }
  const startTime = nanosToMillis(span.startTimeUnixNano);
  const endTime = nanosToMillis(span.endTimeUnixNano);
  if (startTime === void 0 || endTime === void 0) {
    throw new Error(`missing span time bounds`);
  }
  const attributes = { ...resourceAttrs };
  for (const kv of span.attributes ?? []) {
    setAttribute(attributes, kv);
  }
  const events = [];
  for (const ev of span.events ?? []) {
    const decoded = decodeEvent(ev);
    if (decoded) {
      events.push(decoded);
    }
  }
  const status = decodeStatus(span.status?.code, span.status?.message);
  return {
    name: span.name ?? "",
    traceId,
    spanId,
    parentSpanId,
    startTime,
    endTime,
    status,
    attributes,
    events
  };
}
function decodeEvent(ev) {
  if (!ev) {
    return void 0;
  }
  const timestamp = nanosToMillis(ev.timeUnixNano);
  if (timestamp === void 0) {
    return void 0;
  }
  const attributes = {};
  for (const kv of ev.attributes ?? []) {
    setAttribute(attributes, kv);
  }
  return {
    name: ev.name ?? "",
    timestamp,
    attributes: Object.keys(attributes).length > 0 ? attributes : void 0
  };
}
function decodeStatus(code, message) {
  switch (code) {
    case OtlpStatusCode.OK:
      return { code: SpanStatusCode.OK, message };
    case OtlpStatusCode.ERROR:
      return { code: SpanStatusCode.ERROR, message };
    case OtlpStatusCode.UNSET:
    default:
      return { code: SpanStatusCode.UNSET, message };
  }
}
function decodeAttributes(kvs) {
  const out = {};
  if (!kvs) {
    return out;
  }
  for (const kv of kvs) {
    setAttribute(out, kv);
  }
  return out;
}
function setAttribute(target, kv) {
  if (!kv || typeof kv.key !== "string" || kv.key.length === 0) {
    return;
  }
  const value = decodeAnyValue(kv.value);
  if (value !== void 0) {
    target[kv.key] = value;
  }
}
function decodeAnyValue(v) {
  if (!v) {
    return void 0;
  }
  if (typeof v.stringValue === "string") {
    return v.stringValue;
  }
  if (typeof v.boolValue === "boolean") {
    return v.boolValue;
  }
  if (v.intValue !== void 0) {
    const n = typeof v.intValue === "string" ? Number(v.intValue) : v.intValue;
    return Number.isFinite(n) ? n : void 0;
  }
  if (typeof v.doubleValue === "number") {
    return v.doubleValue;
  }
  if (v.arrayValue?.values) {
    const items = v.arrayValue.values.map(decodeAnyValue);
    if (items.every((x) => typeof x === "string")) {
      return items;
    }
    return JSON.stringify(items);
  }
  if (v.kvlistValue?.values) {
    const obj = {};
    for (const kv of v.kvlistValue.values) {
      if (kv && typeof kv.key === "string") {
        obj[kv.key] = decodeAnyValue(kv.value);
      }
    }
    return JSON.stringify(obj);
  }
  if (typeof v.bytesValue === "string") {
    return v.bytesValue;
  }
  return void 0;
}
function nanosToMillis(s) {
  if (s === void 0 || s === "" || s === "0") {
    return void 0;
  }
  const trimmed = s.length <= 6 ? "0" : s.slice(0, -6);
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : void 0;
}
function isValidHex(s, len) {
  return s.length === len && HEX_RE.test(s);
}
export {
  decodeExportTraceRequest
};
