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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { bindContextKey } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IMcpService, LazyCollectionState, McpConnectionState, McpServerCacheState } from "./mcpTypes.js";
var McpContextKeys;
((McpContextKeys2) => {
  McpContextKeys2.serverCount = new RawContextKey("mcp.serverCount", void 0, { type: "number", description: localize("mcp.serverCount.description", "Context key that has the number of registered MCP servers") });
  McpContextKeys2.hasUnknownTools = new RawContextKey("mcp.hasUnknownTools", void 0, { type: "boolean", description: localize("mcp.hasUnknownTools.description", "Indicates whether there are MCP servers with unknown tools.") });
  McpContextKeys2.hasServersWithErrors = new RawContextKey("mcp.hasServersWithErrors", void 0, { type: "boolean", description: localize("mcp.hasServersWithErrors.description", "Indicates whether there are any MCP servers with errors.") });
  McpContextKeys2.toolsCount = new RawContextKey("mcp.toolsCount", void 0, { type: "number", description: localize("mcp.toolsCount.description", "Context key that has the number of registered MCP tools") });
})(McpContextKeys || (McpContextKeys = {}));
let McpContextKeysController = class extends Disposable {
  static {
    this.ID = "workbench.contrib.mcp.contextKey";
  }
  constructor(mcpService, contextKeyService) {
    super();
    const ctxServerCount = McpContextKeys.serverCount.bindTo(contextKeyService);
    const ctxToolsCount = McpContextKeys.toolsCount.bindTo(contextKeyService);
    const ctxHasUnknownTools = McpContextKeys.hasUnknownTools.bindTo(contextKeyService);
    this._store.add(bindContextKey(McpContextKeys.hasServersWithErrors, contextKeyService, (r) => mcpService.servers.read(r).some((c) => c.connectionState.read(r).state === McpConnectionState.Kind.Error)));
    this._store.add(autorun((r) => {
      const servers = mcpService.servers.read(r);
      const serverTools = servers.map((s) => s.tools.read(r));
      ctxServerCount.set(servers.length);
      ctxToolsCount.set(serverTools.reduce((count, tools) => count + tools.length, 0));
      ctxHasUnknownTools.set(mcpService.lazyCollectionState.read(r).state !== LazyCollectionState.AllKnown || servers.some((s) => {
        const toolState = s.cacheState.read(r);
        return toolState === McpServerCacheState.Unknown || toolState === McpServerCacheState.Outdated || toolState === McpServerCacheState.RefreshingFromUnknown;
      }));
    }));
  }
};
McpContextKeysController = __decorateClass([
  __decorateParam(0, IMcpService),
  __decorateParam(1, IContextKeyService)
], McpContextKeysController);
export {
  McpContextKeys,
  McpContextKeysController
};
