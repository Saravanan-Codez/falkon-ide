import * as zlib from "zlib";
import { promisify } from "util";
import { generateUuid } from "../../../base/common/uuid.js";
const GH_STANDARD_IKEY = "7d7048df-6dd0-4048-bb23-b716c1461f8f";
const GH_ENHANCED_IKEY = "3fdd7f28-937a-48c8-9a21-ba337db23bd1";
const GH_TELEMETRY_URL = "https://copilot-telemetry.githubusercontent.com/telemetry";
const NAMESPACE = "copilot-chat";
const MAX_PROPERTY_LENGTH = 8192;
const MAX_CONCATENATED_PROPERTIES = 50;
const MAX_TELEMETRY_ITEM_BODY_LENGTH = MAX_PROPERTY_LENGTH * MAX_CONCATENATED_PROPERTIES;
const COMPRESSED_CHUNK_SUFFIX = "Chunk";
const ALWAYS_COMPRESSED_CHUNK_KEYS = /* @__PURE__ */ new Set(["messagesJson", "diffsJSON"]);
const gzip = promisify(zlib.gzip);
async function compressTelemetryValue(value) {
  const compressed = await gzip(Buffer.from(value, "utf8"));
  return compressed.toString("base64");
}
async function multiplexProperties(properties) {
  const newProperties = { ...properties };
  for (const key in properties) {
    const value = properties[key];
    const valueLength = value?.length ?? 0;
    const forceCompress = value !== void 0 && ALWAYS_COMPRESSED_CHUNK_KEYS.has(key);
    if (valueLength <= MAX_PROPERTY_LENGTH && !forceCompress) {
      continue;
    }
    newProperties[key] = value.slice(0, MAX_PROPERTY_LENGTH);
    const compressed = await compressTelemetryValue(value);
    const compressedChunkKey = key === "messagesJson" ? "messagesJSON" : key;
    for (let offset = 0, index = 1; offset < compressed.length && index <= MAX_CONCATENATED_PROPERTIES; offset += MAX_PROPERTY_LENGTH, index++) {
      const columnName = index === 1 ? `${compressedChunkKey}${COMPRESSED_CHUNK_SUFFIX}` : `${compressedChunkKey}${COMPRESSED_CHUNK_SUFFIX}_${index}`;
      newProperties[columnName] = compressed.slice(offset, offset + MAX_PROPERTY_LENGTH);
    }
  }
  return newProperties;
}
class AgentHostRestrictedTelemetrySender {
  constructor(commonProperties, _logService, _endpointUrl = GH_TELEMETRY_URL, _internalSink, _fetchFn = globalThis.fetch) {
    this._logService = _logService;
    this._endpointUrl = _endpointUrl;
    this._internalSink = _internalSink;
    this._fetchFn = _fetchFn;
    /**
     * Whether the current Copilot token opts into enhanced/restricted telemetry (`rt=1`). Off by
     * default so the sole writer to the restricted table never emits for public users — a hard
     * safety boundary that holds even if the enclosing service's gate is bypassed. Mirrors the
     * Copilot extension, which only creates the restricted reporter for opted-in users.
     */
    this._restrictedTelemetryEnabled = false;
    this._internalTelemetryEnabled = false;
    this._commonProps = {
      client_machineid: asString(commonProperties["common.machineId"]),
      client_deviceid: asString(commonProperties["common.devDeviceId"]),
      client_sessionid: asString(commonProperties["sessionID"]),
      common_os: asString(commonProperties["common.nodePlatform"]) ?? process.platform,
      editor_version: asString(commonProperties["version"])
    };
  }
  sendGHTelemetryEvent(eventName, properties, measurements) {
    this._post(GH_STANDARD_IKEY, eventName, properties, measurements);
  }
  sendEnhancedGHTelemetryEvent(eventName, properties, measurements) {
    if (!this._restrictedTelemetryEnabled) {
      return;
    }
    this._post(GH_ENHANCED_IKEY, eventName, properties, measurements);
  }
  sendEnhancedGHTelemetryEventForContext(context, eventName, properties, measurements) {
    if (!context.restrictedTelemetryEnabled) {
      return;
    }
    this._post(GH_ENHANCED_IKEY, eventName, properties, measurements, {
      endpointUrl: context.telemetryEndpoint,
      trackingId: context.trackingId
    });
  }
  sendInternalMSFTTelemetryEvent(eventName, properties, measurements) {
    if (!this._internalTelemetryEnabled) {
      return;
    }
    if (this._internalSink) {
      this._internalSink.send(eventName, properties, measurements);
      return;
    }
    this._logService.trace(`[ahp-restricted] internal MSFT event (not sent, no internal key): ${eventName}`);
  }
  sendInternalMSFTTelemetryEventForContext(context, eventName, properties, measurements) {
    if (!context.isInternal) {
      return;
    }
    if (this._internalSink) {
      this._internalSink.sendForContext(context, eventName, properties, measurements);
      return;
    }
    this._logService.trace(`[ahp-restricted] internal MSFT event (not sent, no internal key): ${eventName}`);
  }
  setCopilotTrackingId(trackingId) {
    this._commonProps.copilot_trackingId = trackingId || void 0;
  }
  setRestrictedTelemetryEndpoint(endpointUrl) {
    this._endpointUrl = endpointUrl || GH_TELEMETRY_URL;
  }
  setRestrictedTelemetryEnabled(enabled) {
    this._restrictedTelemetryEnabled = enabled;
  }
  setInternalTelemetryContext(context) {
    this._internalTelemetryEnabled = context?.isInternal === true;
    this._internalSink?.setContext(context);
  }
  _post(iKey, eventName, properties, measurements, context) {
    const name = eventName.includes("/") ? eventName : `${NAMESPACE}/${eventName}`;
    const commonProps = context ? { ...this._commonProps, copilot_trackingId: context.trackingId } : this._commonProps;
    const envelope = {
      ver: 1,
      name: `Microsoft.ApplicationInsights.${iKey.replace(/-/g, "")}.Event`,
      time: (/* @__PURE__ */ new Date()).toISOString(),
      sampleRate: 100,
      seq: "",
      iKey,
      tags: { "ai.operation.id": generateUuid() },
      data: {
        baseType: "EventData",
        baseData: {
          name,
          // `unique_id` is a fresh per-event id (its hydro column is read by the Copilot
          // Telemetry Service from the snake_case `unique_id` property, NOT `uniqueId`),
          // mirroring the Copilot extension so each emitted event stays individually
          // addressable. Placed first so explicit properties still win on collision.
          properties: context ? { unique_id: generateUuid(), ...commonProps, ...properties, copilot_trackingId: context.trackingId } : { unique_id: generateUuid(), ...commonProps, ...properties },
          measurements: measurements ?? {}
        }
      }
    };
    const body = JSON.stringify(envelope);
    const bodyLength = Buffer.byteLength(body, "utf8");
    if (bodyLength > MAX_TELEMETRY_ITEM_BODY_LENGTH) {
      this._logService.trace(`[ahp-restricted] drop ${name}: serialized body is ${bodyLength} bytes (maximum ${MAX_TELEMETRY_ITEM_BODY_LENGTH})`);
      return;
    }
    this._logService.trace(`[ahp-restricted] emit ${name} (iKey ${iKey.slice(0, 8)})`);
    if (typeof this._fetchFn !== "function") {
      this._logService.warn("[ahp-restricted] global fetch unavailable; telemetry not sent");
      return;
    }
    this._fetchFn(context?.endpointUrl || (context ? GH_TELEMETRY_URL : this._endpointUrl), {
      method: "POST",
      headers: { "Content-Type": "application/x-json-stream" },
      body
    }).then((res) => {
      if (!res.ok) {
        this._logService.warn(`[ahp-restricted] ${name} rejected: HTTP ${res.status}`);
      }
    }).catch((err) => {
      this._logService.warn(`[ahp-restricted] ${name} POST failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
}
function asString(value) {
  return typeof value === "string" ? value : value === void 0 ? void 0 : String(value);
}
export {
  AgentHostRestrictedTelemetrySender,
  multiplexProperties
};
