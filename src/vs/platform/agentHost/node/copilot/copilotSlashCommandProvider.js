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
import { ILogService } from "../../../log/common/log.js";
import { raceTimeout } from "../../../../base/common/async.js";
let CopilotSlashCommandProvider = class {
  constructor(listCommands, _logService) {
    this.listCommands = listCommands;
    this._logService = _logService;
  }
  async getSlashCommands(options) {
    try {
      const maxWaitMs = options?.maxWaitMs;
      const catalog = await this._getRuntimeSlashCommandCatalog(maxWaitMs === void 0 ? void 0 : Math.max(0, maxWaitMs));
      return catalog.commands;
    } catch (err) {
      this._logService.warn(`[Copilot] rpc.commands.list failed`, err);
      return [];
    }
  }
  async resolveSlashCommand(command, maxWaitMs = void 0) {
    const key = this._normalizeSlashCommandKey(command);
    if (!key) {
      return void 0;
    }
    const catalog = await this._getRuntimeSlashCommandCatalog(maxWaitMs);
    return catalog.byName.get(key) ?? catalog.byAlias.get(key);
  }
  clearCache() {
    if (this._runtimeSlashCommandCache) {
      this._runtimeSlashCommandCache = void 0;
    }
  }
  async _getRuntimeSlashCommandCatalog(maxWaitMs = void 0) {
    const cache = this._runtimeSlashCommandCache ??= {};
    if (cache.value) {
      return cache.value;
    }
    const inFlight = this._refreshRuntimeSlashCommandCatalog(cache);
    if (maxWaitMs === void 0) {
      return inFlight;
    }
    const settled = await raceTimeout(inFlight, maxWaitMs);
    if (settled) {
      return settled;
    }
    if (cache.value) {
      return cache.value;
    }
    return {
      commands: [],
      byName: /* @__PURE__ */ new Map(),
      byAlias: /* @__PURE__ */ new Map()
    };
  }
  async _refreshRuntimeSlashCommandCatalog(cache) {
    if (cache.inFlight) {
      return cache.inFlight;
    }
    const inFlight = this.listCommands().then((result) => this._toRuntimeSlashCommandCatalog(result));
    cache.inFlight = inFlight;
    inFlight.then((catalog) => {
      if (this._runtimeSlashCommandCache === cache) {
        cache.value = catalog;
        cache.inFlight = void 0;
      }
    }, () => {
      if (this._runtimeSlashCommandCache === cache) {
        cache.inFlight = void 0;
        if (!cache.value) {
          this._runtimeSlashCommandCache = void 0;
        }
      }
    });
    return inFlight;
  }
  _toRuntimeSlashCommandCatalog(commands) {
    const byName = /* @__PURE__ */ new Map();
    const byAlias = /* @__PURE__ */ new Map();
    const deduped = [];
    for (const command of commands) {
      const nameKey = this._normalizeSlashCommandKey(command.name);
      if (!nameKey) {
        continue;
      }
      let canonical = byName.get(nameKey);
      if (!canonical) {
        canonical = command;
        byName.set(nameKey, canonical);
        deduped.push(canonical);
      }
      for (const alias of command.aliases ?? []) {
        const aliasKey = this._normalizeSlashCommandKey(alias);
        if (!aliasKey || byAlias.has(aliasKey)) {
          continue;
        }
        byAlias.set(aliasKey, canonical);
      }
    }
    return { commands: deduped, byName, byAlias };
  }
  _normalizeSlashCommandKey(command) {
    const trimmed = command.trim();
    if (!trimmed) {
      return void 0;
    }
    const slashStripped = trimmed.charCodeAt(0) === 47 ? trimmed.slice(1) : trimmed;
    return slashStripped.toLowerCase();
  }
};
CopilotSlashCommandProvider = __decorateClass([
  __decorateParam(1, ILogService)
], CopilotSlashCommandProvider);
export {
  CopilotSlashCommandProvider
};
