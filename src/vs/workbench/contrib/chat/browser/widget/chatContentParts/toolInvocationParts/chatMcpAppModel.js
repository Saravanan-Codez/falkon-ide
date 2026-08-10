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
import * as dom from "../../../../../../../base/browser/dom.js";
import { softAssertNever } from "../../../../../../../base/common/assert.js";
import { disposableTimeout } from "../../../../../../../base/common/async.js";
import { decodeBase64 } from "../../../../../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../../../../../base/common/cancellation.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { hash } from "../../../../../../../base/common/hash.js";
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { autorun, autorunSelfDisposable, observableValue } from "../../../../../../../base/common/observable.js";
import { basename } from "../../../../../../../base/common/resources.js";
import { isFalsyOrWhitespace } from "../../../../../../../base/common/strings.js";
import { hasKey, isDefined } from "../../../../../../../base/common/types.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../../../base/common/uuid.js";
import { localize } from "../../../../../../../nls.js";
import { IChatResponseResourceFileSystemProvider } from "../../../../common/widget/chatResponseResourceFileSystemProvider.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../../../platform/log/common/log.js";
import { IOpenerService } from "../../../../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../../../../platform/product/common/productService.js";
import { IStorageService } from "../../../../../../../platform/storage/common/storage.js";
import { McpToolCallUI } from "../../../../../mcp/browser/mcpToolCallUI.js";
import { McpResourceURI } from "../../../../../mcp/common/mcpTypes.js";
import { McpApps } from "../../../../../mcp/common/modelContextProtocolApps.js";
import { IWebviewService, WebviewContentPurpose, WebviewOriginStore } from "../../../../../webview/browser/webview.js";
import { IChatToolInvocation } from "../../../../common/chatService/chatService.js";
import { isToolResultInputOutputDetails } from "../../../../common/tools/languageModelToolsService.js";
import { IChatWidgetService } from "../../../chat.js";
const ORIGIN_STORE_KEY = "chatMcpApp.origins";
let ChatMcpAppModel = class extends Disposable {
  constructor(toolInvocation, renderData, _container, maxHeight, currentWidth, _instantiationService, _chatWidgetService, _webviewService, storageService, _chatResponseResourceFsProvider, _logService, _productService, _openerService) {
    super();
    this.toolInvocation = toolInvocation;
    this.renderData = renderData;
    this._container = _container;
    this._instantiationService = _instantiationService;
    this._chatWidgetService = _chatWidgetService;
    this._webviewService = _webviewService;
    this._chatResponseResourceFsProvider = _chatResponseResourceFsProvider;
    this._logService = _logService;
    this._productService = _productService;
    this._openerService = _openerService;
    /** Cancellation source for async operations */
    this._disposeCts = this._register(new CancellationTokenSource());
    /** Whether ui/initialize has been called and capabilities announced */
    this._announcedCapabilities = false;
    /** Latest CSP used for the frame */
    this._latestCsp = void 0;
    /** Observable for load state */
    this._loadState = observableValue(this, { status: "loading" });
    this.loadState = this._loadState;
    /** Event fired when height changes */
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    /** Accumulated download resource parts from ui/download-file calls */
    this._downloadParts = observableValue(this, []);
    this.downloadParts = this._downloadParts;
    this._originStore = new WebviewOriginStore(ORIGIN_STORE_KEY, storageService);
    this._webviewOrigin = this._computeWebviewOrigin();
    this._mcpToolCallUI = this._register(this._instantiationService.createInstance(McpToolCallUI, renderData));
    this._height = ChatMcpAppModel.heightCache.get(this.toolInvocation) ?? 300;
    this._webview = this._register(this._webviewService.createWebviewElement({
      origin: this._webviewOrigin,
      title: localize("mcpAppTitle", "MCP App"),
      options: {
        purpose: WebviewContentPurpose.ChatOutputItem,
        enableFindWidget: false,
        disableServiceWorker: true,
        retainContextWhenHidden: true
      },
      contentOptions: {
        allowMultipleAPIAcquire: true,
        allowScripts: true,
        allowForms: true
      },
      extension: void 0
    }));
    const targetWindow = dom.getWindow(this._container);
    this._webview.mountTo(this._container, targetWindow);
    this.hostContext = this._mcpToolCallUI.hostContext.map((context, reader) => ({
      ...context,
      containerDimensions: {
        width: currentWidth.read(reader),
        maxHeight: maxHeight.read(reader)
      },
      toolCall: {
        toolCallId: this.toolInvocation.toolCallId,
        toolName: this.toolInvocation.toolId
      }
    }));
    this._register(autorun((reader) => {
      const context = this.hostContext.read(reader);
      if (this._announcedCapabilities) {
        this._sendNotification({
          method: "ui/notifications/host-context-changed",
          params: context
        });
      }
    }));
    this._register(this._webview.onMessage(async ({ message }) => {
      await this._handleWebviewMessage(message);
    }));
    this._register(this._mcpToolCallUI.onNotification((n) => {
      if (!this._announcedCapabilities) {
        return;
      }
      this._webview.postMessage({ jsonrpc: "2.0", method: n.method, params: n.params });
    }));
    this._loadContent();
  }
  static {
    this.heightCache = /* @__PURE__ */ new WeakMap();
  }
  static {
    /**
     * In-memory origin map for agent-host MCP servers. Agent-host server
     * ids embed the session id, so they're effectively single-use across
     * VS Code restarts — using {@link WebviewOriginStore} for them would
     * accumulate one persisted entry per agent-host session forever. The
     * in-memory map keeps origins stable for the lifetime of the app
     * (enough for webview state to persist across re-renders) without
     * touching application storage.
     */
    this._agentHostOrigins = /* @__PURE__ */ new Map();
  }
  /**
   * Gets the current height of the webview.
   */
  get height() {
    return this._height;
  }
  remount() {
    this._webview.reinitializeAfterDismount();
    this._announcedCapabilities = false;
  }
  /**
   * Retries loading the MCP App content.
   */
  retry() {
    this._loadState.set({ status: "loading" }, void 0);
    this._loadContent();
  }
  /**
   * Loads the MCP App content into the webview.
   */
  async _loadContent() {
    const token = this._disposeCts.token;
    try {
      const resourceContent = await this._mcpToolCallUI.loadResource(token);
      if (token.isCancellationRequested) {
        return;
      }
      const htmlWithCsp = this._injectPreamble(resourceContent);
      this._announcedCapabilities = false;
      this._latestCsp = resourceContent.csp;
      this._webview.setHtml(htmlWithCsp);
      this._loadState.set({ status: "loaded" }, void 0);
    } catch (error) {
      this._logService.error("[MCP App] Error loading app:", error);
      this._loadState.set({ status: "error", error }, void 0);
    }
  }
  /**
   * Injects a Content-Security-Policy meta tag into the HTML.
   */
  _injectPreamble({ html, csp }) {
    const cleanDomains = (s) => (s?.join(" ") || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const cspContent = `
			default-src 'none';
			script-src 'self' 'unsafe-inline' ${cleanDomains(csp?.resourceDomains)};
			style-src 'self' 'unsafe-inline' ${cleanDomains(csp?.resourceDomains)};
			connect-src 'self' ${cleanDomains(csp?.connectDomains)};
			img-src 'self' data: ${cleanDomains(csp?.resourceDomains)};
			font-src 'self' ${cleanDomains(csp?.resourceDomains)};
			media-src 'self' data: ${cleanDomains(csp?.resourceDomains)};
			frame-src ${cleanDomains(csp?.frameDomains) || `'none'`};
			object-src 'none';
			base-uri ${cleanDomains(csp?.baseUriDomains) || `'self'`};
		`;
    const cspTag = `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`;
    const postMessageRehoist = `
			<script>(() => {
				const api = acquireVsCodeApi();
				const setMessageSource = (obj, src) => new Proxy(obj, {
					get: (target, prop) => {
						if (prop === 'source')  {
							return src;
						}
						return target[prop];
					}
				});

				const wrappedFns = new WeakMap();

				let patchedPostMessage = (message, transfer) => api.postMessage(message, transfer);
				const wrap = target => new Proxy(target, {
					set: (obj, prop, value) => {
						if (prop === 'postMessage') {
							patchedPostMessage = (message, transfer) => value.call(target, message, transfer);
						} else {
							obj[prop] = value;
						}
						return true;
					},
					get: (obj, prop) => {
						if (prop === 'postMessage') {
							return patchedPostMessage;
						}
						return obj[prop];
					},
				});

				const originalAddEventListener = window.addEventListener.bind(window);
				window.addEventListener = (type, listener, options) => {
					if (type === 'message') {
						const originalListener = listener;
						const wrappedListener = (event) => {
							if (event.origin === document.location.origin && event.source !== window) { event = setMessageSource(event, window.parent); }
							originalListener(event);
						};
						wrappedFns.set(originalListener, wrappedListener);
						listener = wrappedListener;
					}

					return originalAddEventListener(type, listener, options);
				};

				const originalRemoveEventListener = window.removeEventListener.bind(window);
				window.removeEventListener = (type, listener, options) => {
					const wrappedListener = wrappedFns.get(listener) || listener;
					return originalRemoveEventListener(type, wrappedListener, options);
				};

				window.parent = wrap(window.parent);

				// Scroll boundary detection: bubble wheel events to parent when at scroll boundaries
				const shouldBubbleScroll = (event) => {
					// First check element-level scrolling (for elements with overflow: auto/scroll)
					for (let node = event.target; node; node = node.parentNode) {
						if (!(node instanceof Element)) {
							continue;
						}

						// Skip HTML and BODY - we check document-level scroll separately
						if (node === document.documentElement || node === document.body) {
							continue;
						}

						// Check if the element can actually scroll
						const overflow = window.getComputedStyle(node).overflowY;
						if (overflow === 'hidden' || overflow === 'visible') {
							continue;
						}

						// Scroll up: if there's content above (scrollTop > 0), don't bubble
						if (event.deltaY < 0 && node.scrollTop > 0) {
							return false;
						}

						// Scroll down: if there's content below, don't bubble
						if (event.deltaY > 0 && node.scrollTop + node.clientHeight < node.scrollHeight) {
							// Account for rounding: scrollTop isn't rounded but scrollHeight/clientHeight are
							if (node.scrollHeight - node.scrollTop - node.clientHeight < 2) {
								continue;
							}
							return false;
						}
					}

					// Check document-level scrolling (works even with overflow: visible on html/body)
					const docEl = document.documentElement;
					const scrollTop = window.scrollY || docEl.scrollTop || document.body.scrollTop || 0;
					const scrollHeight = Math.max(docEl.scrollHeight, document.body.scrollHeight);
					const clientHeight = docEl.clientHeight;
					const scrollableDistance = scrollHeight - clientHeight;

					if (scrollableDistance > 2) {
						// Document is scrollable
						if (event.deltaY < 0 && scrollTop > 0) {
							return false;
						}
						if (event.deltaY > 0 && scrollTop < scrollableDistance - 2) {
							return false;
						}
					}

					return true;
				};

				window.addEventListener('wheel', (event) => {
					if (event.defaultPrevented || !shouldBubbleScroll(event)) {
						return;
					}
					api.postMessage({
						method: 'ui/notifications/sandbox-wheel',
						params: {
							deltaMode: event.deltaMode,
							deltaX: event.deltaX,
							deltaY: event.deltaY,
							deltaZ: event.deltaZ,
						}
					});
				}, { passive: true });
			})();<\/script>
		`;
    return this._prependToHead(html, cspTag + postMessageRehoist);
  }
  _prependToHead(html, content) {
    const headMatch = html.match(/<head[^>]*>/i);
    if (headMatch) {
      const insertIndex = headMatch.index + headMatch[0].length;
      return html.slice(0, insertIndex) + "\n" + content + html.slice(insertIndex);
    }
    const htmlMatch = html.match(/<html[^>]*>/i);
    if (htmlMatch) {
      const insertIndex = htmlMatch.index + htmlMatch[0].length;
      return html.slice(0, insertIndex) + "\n<head>" + content + "</head>" + html.slice(insertIndex);
    }
    return `<!DOCTYPE html><html><head>${content}</head><body>${html}</body></html>`;
  }
  /**
   * Handles incoming JSON-RPC messages from the webview.
   */
  async _handleWebviewMessage(message) {
    const request = message;
    const token = this._disposeCts.token;
    try {
      let result = {};
      switch (request.method) {
        case "ui/initialize":
          result = await this._handleInitialize(request.params);
          break;
        case "tools/call":
          result = await this._handleToolsCall(request.params, token);
          break;
        case "resources/read":
          result = await this._handleResourcesRead(request.params, token);
          break;
        case "sampling/createMessage":
          result = await this._handleSamplingCreateMessage(request.params, token);
          break;
        case "ping":
          break;
        case "ui/notifications/size-changed":
          this._handleSizeChanged(request.params);
          break;
        case "ui/open-link":
          result = await this._handleOpenLink(request.params);
          break;
        case "ui/download-file":
          result = await this._handleDownloadFile(request.params);
          break;
        case "ui/request-display-mode":
          result = { mode: "inline" };
          break;
        case "ui/notifications/initialized":
          break;
        case "ui/message":
          result = await this._handleUiMessage(request.params);
          break;
        case "ui/update-model-context":
          result = await this._handleUpdateModelContext(request.params);
          break;
        case "notifications/message":
          await this._mcpToolCallUI.log(request.params);
          break;
        case "ui/notifications/sandbox-wheel":
          this._handleSandboxWheel(request.params);
          break;
        default: {
          softAssertNever(request);
          const cast = request;
          if (cast.id !== void 0) {
            await this._sendError(cast.id, -32601, `Method not found: ${cast.method}`);
          }
          return;
        }
      }
      if (hasKey(request, { id: true })) {
        await this._sendResponse(request.id, result);
      }
    } catch (error) {
      this._logService.error(`[MCP App] Error handling ${request.method}:`, error);
      if (hasKey(request, { id: true })) {
        const message2 = error instanceof Error ? error.message : String(error);
        await this._sendError(request.id, -32e3, message2);
      }
    }
  }
  /**
   * Handles the ui/initialize request from the MCP App View.
   */
  async _handleInitialize(_params) {
    this._announcedCapabilities = true;
    let args;
    try {
      args = JSON.parse(this.renderData.input);
    } catch {
      args = this.renderData.input;
    }
    const timeout = this._register(disposableTimeout(async () => {
      this._store.delete(timeout);
      await this._sendNotification({
        method: "ui/notifications/tool-input",
        params: { arguments: args }
      });
      if (this.toolInvocation.kind === "toolInvocationSerialized") {
        this._sendToolResult(this.toolInvocation.resultDetails);
      } else if (this.toolInvocation.kind === "toolInvocation") {
        const invocation = this.toolInvocation;
        this._register(autorunSelfDisposable((reader) => {
          const state = invocation.state.read(reader);
          if (state.type === IChatToolInvocation.StateKind.Completed) {
            this._sendToolResult(state.resultDetails);
            reader.dispose();
          }
        }));
      }
    }));
    return {
      protocolVersion: McpApps.LATEST_PROTOCOL_VERSION,
      hostInfo: {
        name: this._productService.nameLong,
        version: this._productService.version
      },
      hostCapabilities: {
        openLinks: {},
        serverTools: { listChanged: true },
        serverResources: { listChanged: true },
        logging: {},
        sandbox: {
          csp: this._latestCsp,
          permissions: { clipboardWrite: {} }
        },
        updateModelContext: {
          audio: {},
          image: {},
          resourceLink: {},
          resource: {},
          structuredContent: {}
        },
        downloadFile: {}
      },
      hostContext: this.hostContext.get()
    };
  }
  /**
   * Sends the tool result notification when the result becomes available.
   */
  /**
   * Returns a stable identifier for the originating MCP server to use
   * as the webview origin key. Local servers use their definition id,
   * agent-host servers use the per-session `serverId`.
   */
  _serverOriginId() {
    return this.renderData.kind === "agentHost" ? this.renderData.serverId : this.renderData.serverDefinitionId;
  }
  /**
   * Picks a stable webview origin for this server. Local MCP servers
   * get a persisted origin via {@link WebviewOriginStore} since their
   * server-definition id is stable across VS Code restarts. Agent-host
   * servers fall back to the static in-memory {@link _agentHostOrigins}
   * map keyed by `serverId`, so origins are stable within the app
   * lifetime without leaking entries into application storage for
   * every session.
   */
  _computeWebviewOrigin() {
    if (this.renderData.kind !== "agentHost") {
      return this._originStore.getOrigin("mcpApp", this._serverOriginId());
    }
    const key = this._serverOriginId();
    let origin = ChatMcpAppModel._agentHostOrigins.get(key);
    if (!origin) {
      origin = generateUuid();
      ChatMcpAppModel._agentHostOrigins.set(key, origin);
    }
    return origin;
  }
  /**
   * Resolves a server-relative resource URI into a workbench URI.
   * - Local servers: wrap in {@link McpResourceURI.fromServer} so it
   *   resolves through the MCP filesystem provider.
   * - Agent-host servers: pass through as a plain {@link URI}. There's
   *   no host-side resolver for AHP-backed servers in v1, so these
   *   URIs may not be openable, but they preserve the original
   *   resource reference for the user.
   */
  _resolveServerResourceUri(serverUri) {
    if (this.renderData.kind === "agentHost") {
      return URI.parse(serverUri);
    }
    return McpResourceURI.fromServer({ id: this.renderData.serverDefinitionId, label: "" }, serverUri);
  }
  _sendToolResult(resultDetails) {
    if (isToolResultInputOutputDetails(resultDetails) && resultDetails.mcpOutput) {
      this._sendNotification({
        method: "ui/notifications/tool-result",
        params: resultDetails.mcpOutput
      });
    }
  }
  async _handleUiMessage(params) {
    const widget = this._chatWidgetService.getWidgetBySessionResource(this.renderData.sessionResource);
    if (!widget) {
      return { isError: true };
    }
    if (!isFalsyOrWhitespace(widget.getInput())) {
      return { isError: true };
    }
    widget.setInput(params.content.filter((c) => c.type === "text").map((c) => c.text).join("\n\n"));
    widget.attachmentModel.clearAndSetContext(...params.content.map((c, i) => {
      const id = `mcpui-${i}-${Date.now()}`;
      if (c.type === "image") {
        return { kind: "image", value: decodeBase64(c.data).buffer, id, name: "Image" };
      } else if (c.type === "resource_link") {
        const uri = this._resolveServerResourceUri(c.uri);
        return { kind: "file", value: uri, id, name: basename(uri) };
      } else {
        return void 0;
      }
    }).filter(isDefined));
    widget.focusInput();
    return { isError: false };
  }
  async _handleUpdateModelContext(params) {
    const widget = this._chatWidgetService.getWidgetBySessionResource(this.renderData.sessionResource);
    if (!widget) {
      return {};
    }
    const idPrefix = `mcpui-context-${hash(this._serverOriginId())}-`;
    const toDelete = widget.attachmentModel.getAttachmentIDs();
    const idsToDelete = Array.from(toDelete).filter((id) => id.startsWith(idPrefix));
    const entries = [];
    let entryIndex = 0;
    if (params.content) {
      for (const block of params.content) {
        const id = `${idPrefix}${entryIndex++}`;
        if (block.type === "image") {
          entries.push({
            kind: "image",
            value: decodeBase64(block.data).buffer,
            id,
            name: "Image",
            mimeType: block.mimeType
          });
        } else if (block.type === "resource_link") {
          const uri = this._resolveServerResourceUri(block.uri);
          entries.push({
            kind: "file",
            value: uri,
            id,
            name: basename(uri)
          });
        } else if (block.type === "text") {
          const preview = block.text.replaceAll(/\s+/g, " ").trim();
          const truncateTo = 20;
          entries.push({
            kind: "generic",
            value: block.text,
            id,
            tooltip: new MarkdownString().appendCodeblock("plaintext", block.text),
            name: preview.length > truncateTo ? preview.slice(0, truncateTo) + "\u2026" : preview
          });
        }
      }
    }
    if (params.structuredContent && Object.keys(params.structuredContent).length > 0) {
      const id = `${idPrefix}structured`;
      const value = JSON.stringify(params.structuredContent, null, 2);
      entries.push({
        kind: "generic",
        value,
        tooltip: new MarkdownString().appendCodeblock("json", value),
        id,
        name: "UI Data"
      });
    }
    widget.attachmentModel.updateContext(idsToDelete, entries);
    return {};
  }
  _handleSizeChanged(params) {
    if (params.height !== void 0 && params.height !== this._height) {
      this._height = params.height;
      ChatMcpAppModel.heightCache.set(this.toolInvocation, params.height);
      this._onDidChangeHeight.fire();
    }
  }
  _handleSandboxWheel(params) {
    let defaultPrevented = false;
    const evt = {
      wheelDeltaX: params.deltaX,
      wheelDeltaY: -params.deltaY,
      wheelDelta: Math.abs(params.deltaY),
      deltaX: params.deltaX,
      deltaY: -params.deltaY,
      deltaZ: params.deltaZ,
      deltaMode: params.deltaMode,
      preventDefault: () => {
        defaultPrevented = true;
      },
      stopPropagation: () => {
      },
      get defaultPrevented() {
        return defaultPrevented;
      }
    };
    const widget = this._chatWidgetService.getWidgetBySessionResource(this.renderData.sessionResource);
    widget?.delegateScrollFromMouseWheelEvent(evt);
  }
  async _handleDownloadFile(params) {
    const newParts = [];
    let hadError = false;
    for (const content of params.contents) {
      try {
        if (content.type === "resource") {
          const resource = content.resource;
          const parsed = URI.parse(resource.uri);
          const data = hasKey(resource, { text: true }) ? new TextEncoder().encode(resource.text) : { base64: resource.blob };
          const uri = this._chatResponseResourceFsProvider.associate(this.renderData.sessionResource, data, basename(parsed));
          newParts.push({ kind: "data", mimeType: resource.mimeType, uri });
        } else if (content.type === "resource_link") {
          const mcpUri = this._resolveServerResourceUri(content.uri);
          newParts.push({ kind: "data", mimeType: content.mimeType, uri: mcpUri });
        }
      } catch (error) {
        hadError = true;
        this._logService.warn("[MCP App] Failed to process ui/download-file content", error);
      }
    }
    if (newParts.length > 0) {
      const existing = this._downloadParts.get();
      this._downloadParts.set([...existing, ...newParts], void 0);
    }
    return hadError ? { isError: true } : {};
  }
  async _handleOpenLink(params) {
    let parsed;
    try {
      parsed = URI.parse(params.url, true);
    } catch {
      this._logService.warn(`[MCP App] Rejected ui/open-link with unparseable URL`);
      return { isError: true };
    }
    if (parsed.scheme !== "http" && parsed.scheme !== "https") {
      this._logService.warn(`[MCP App] Rejected ui/open-link with non-http(s) scheme: ${parsed.scheme}`);
      return { isError: true };
    }
    const ok = await this._openerService.open(parsed, { openExternal: true });
    return { isError: !ok };
  }
  /**
   * Handles tools/call requests from the MCP App.
   */
  async _handleToolsCall(params, token) {
    if (!params?.name) {
      throw new Error("Missing tool name in tools/call request");
    }
    return this._mcpToolCallUI.callTool(params.name, params.arguments || {}, token);
  }
  /**
   * Handles resources/read requests from the MCP App.
   */
  async _handleResourcesRead(params, token) {
    if (!params?.uri) {
      throw new Error("Missing uri in resources/read request");
    }
    return this._mcpToolCallUI.readResource(params.uri, token);
  }
  /**
   * Handles sampling/createMessage requests from the MCP App. Forwarded
   * to the host-side sampling implementation through the underlying
   * transport (typically an agent host that owns the MCP server).
   */
  async _handleSamplingCreateMessage(params, token) {
    if (!params) {
      throw new Error("Missing params in sampling/createMessage request");
    }
    return this._mcpToolCallUI.sampling(params, token);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async _sendResponse(id, result) {
    await this._webview.postMessage({
      jsonrpc: "2.0",
      id,
      result
    });
  }
  async _sendError(id, code, message) {
    await this._webview.postMessage({
      jsonrpc: "2.0",
      id,
      error: { code, message }
    });
  }
  async _sendNotification(message) {
    await this._webview.postMessage({
      jsonrpc: "2.0",
      ...message
    });
  }
  dispose() {
    this._disposeCts.dispose(true);
    super.dispose();
  }
};
ChatMcpAppModel = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IChatWidgetService),
  __decorateParam(7, IWebviewService),
  __decorateParam(8, IStorageService),
  __decorateParam(9, IChatResponseResourceFileSystemProvider),
  __decorateParam(10, ILogService),
  __decorateParam(11, IProductService),
  __decorateParam(12, IOpenerService)
], ChatMcpAppModel);
export {
  ChatMcpAppModel
};
