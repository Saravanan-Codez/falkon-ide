var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { getErrorMessage } from "../../../../../base/common/errors.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { ChatConfiguration } from "../../common/constants.js";
import { formatCompressionBanner, isProtectedFromCompression, MIN_COMPRESSIBLE_LENGTH } from "../../common/tools/toolResultCompressor.js";
let ToolResultCompressorService = class extends Disposable {
  constructor(_configurationService, _telemetryService, _logService) {
    super();
    this._configurationService = _configurationService;
    this._telemetryService = _telemetryService;
    this._logService = _logService;
    this._filters = /* @__PURE__ */ new Map();
    this._caches = /* @__PURE__ */ new Map();
  }
  registerFilter(filter) {
    for (const id of filter.toolIds) {
      let bucket = this._filters.get(id);
      if (!bucket) {
        bucket = [];
        this._filters.set(id, bucket);
      }
      bucket.push(filter);
    }
  }
  registerCache(cache) {
    for (const id of cache.toolIds) {
      let bucket = this._caches.get(id);
      if (!bucket) {
        bucket = [];
        this._caches.set(id, bucket);
      }
      bucket.push(cache);
    }
  }
  maybeCompress(toolId, input, result) {
    if (!this._configurationService.getValue(ChatConfiguration.CompressOutputEnabled)) {
      return void 0;
    }
    const caches = this._caches.get(toolId);
    if (caches && caches.length > 0) {
      for (const c of caches) {
        try {
          c.observe(toolId, input);
        } catch (err) {
          this._logService.warn(`[ToolResultCompressor] cache ${c.id} threw in observe on tool ${toolId}: ${getErrorMessage(err)}`, err);
        }
      }
      for (const c of caches) {
        let hit;
        try {
          hit = c.lookup(toolId, input);
        } catch (err) {
          this._logService.warn(`[ToolResultCompressor] cache ${c.id} threw in lookup on tool ${toolId}: ${getErrorMessage(err)}`, err);
          continue;
        }
        if (hit) {
          const totalBefore2 = result.content.reduce((acc, p) => acc + (p.kind === "text" ? p.value.length : 0), 0);
          if (totalBefore2 < MIN_COMPRESSIBLE_LENGTH) {
            continue;
          }
          const hasProtectedContent = result.content.some((p) => p.kind === "text" && isProtectedFromCompression(p.value));
          if (hasProtectedContent) {
            continue;
          }
          const cachedResult = this._buildCacheHitResult(result, hit);
          const totalAfter2 = cachedResult.content.reduce((acc, p) => acc + (p.kind === "text" ? p.value.length : 0), 0);
          if (totalAfter2 >= totalBefore2) {
            continue;
          }
          this._sendTelemetry(toolId, [`cache:${c.id}`], totalBefore2, totalAfter2, true);
          return cachedResult;
        }
      }
    }
    const filters = this._filters.get(toolId);
    const matchingFilters = filters?.filter((f) => {
      try {
        return f.matches(toolId, input);
      } catch (err) {
        this._logService.warn(`[ToolResultCompressor] filter ${f.id} threw in matches on tool ${toolId}: ${getErrorMessage(err)}`, err);
        return false;
      }
    }) ?? [];
    if (matchingFilters.length === 0) {
      this._recordInCaches(toolId, input, result, caches);
      return void 0;
    }
    const activeFilters = matchingFilters.slice();
    const disabledFilterIds = /* @__PURE__ */ new Set();
    let totalBefore = 0;
    let totalAfter = 0;
    let anyCompressed = false;
    const usedFilterIds = /* @__PURE__ */ new Set();
    const newContent = result.content.map((part) => {
      if (part.kind !== "text") {
        return part;
      }
      const original = part.value;
      totalBefore += original.length;
      if (original.length < MIN_COMPRESSIBLE_LENGTH) {
        totalAfter += original.length;
        return part;
      }
      if (isProtectedFromCompression(original)) {
        totalAfter += original.length;
        return part;
      }
      let current = original;
      const partFilterIds = [];
      for (let i = 0; i < activeFilters.length; ) {
        const filter = activeFilters[i];
        try {
          const out = filter.apply(current, input);
          if (out.compressed && out.text.length < current.length) {
            current = out.text;
            usedFilterIds.add(filter.id);
            partFilterIds.push(filter.id);
          }
          i++;
        } catch (err) {
          activeFilters.splice(i, 1);
          if (!disabledFilterIds.has(filter.id)) {
            disabledFilterIds.add(filter.id);
            this._logService.warn(`[ToolResultCompressor] filter ${filter.id} threw on tool ${toolId}; disabled for this pass: ${getErrorMessage(err)}`, err);
          }
        }
      }
      totalAfter += current.length;
      if (current !== original) {
        anyCompressed = true;
        const banner = formatCompressionBanner(partFilterIds, original.length, current.length);
        const annotated = `${banner}
${current}`;
        const rewritten = {
          kind: "text",
          value: annotated,
          audience: part.audience,
          title: part.title
        };
        return rewritten;
      }
      return part;
    });
    if (!anyCompressed) {
      this._recordInCaches(toolId, input, result, caches);
      return void 0;
    }
    this._sendTelemetry(toolId, [...usedFilterIds], totalBefore, totalAfter, false);
    const finalResult = {
      ...result,
      content: newContent
    };
    this._recordInCaches(toolId, input, finalResult, caches);
    return finalResult;
  }
  _buildCacheHitResult(original, hit) {
    const iso = new Date(hit.timestamp).toISOString();
    const text = `Same output as last run (${iso}). To disable, set ${ChatConfiguration.CompressOutputEnabled} to false.`;
    const firstText = original.content.find((p) => p.kind === "text");
    const replacement = {
      kind: "text",
      value: text,
      audience: firstText?.audience,
      title: firstText?.title
    };
    const nonText = original.content.filter((p) => p.kind !== "text");
    return { ...original, content: [replacement, ...nonText] };
  }
  _recordInCaches(toolId, input, result, caches) {
    if (!caches || caches.length === 0) {
      return;
    }
    const text = result.content.filter((p) => p.kind === "text").map((p) => p.value).join("\n");
    if (!text) {
      return;
    }
    for (const c of caches) {
      try {
        c.record(toolId, input, text);
      } catch (err) {
        this._logService.warn(`[ToolResultCompressor] cache ${c.id} threw in record on tool ${toolId}: ${getErrorMessage(err)}`, err);
      }
    }
  }
  _sendTelemetry(toolId, filterIds, beforeChars, afterChars, cacheHit) {
    this._telemetryService.publicLog2(
      "toolResultCompressed",
      {
        toolId,
        filters: filterIds.join(","),
        beforeChars,
        afterChars,
        cacheHit
      }
    );
  }
};
ToolResultCompressorService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, ILogService)
], ToolResultCompressorService);
export {
  ToolResultCompressorService
};
