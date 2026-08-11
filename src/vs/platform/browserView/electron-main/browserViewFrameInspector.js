var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : /* @__PURE__ */ Symbol.for("Symbol." + name);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __using = (stack, value, async) => {
  if (value != null) {
    if (typeof value !== "object" && typeof value !== "function") __typeError("Object expected");
    var dispose, inner;
    if (async) dispose = value[__knownSymbol("asyncDispose")];
    if (dispose === void 0) {
      dispose = value[__knownSymbol("dispose")];
      if (async) inner = dispose;
    }
    if (typeof dispose !== "function") __typeError("Object not disposable");
    if (inner) dispose = function() {
      try {
        inner.call(this);
      } catch (e) {
        return Promise.reject(e);
      }
    };
    stack.push([async, dispose, value]);
  } else if (async) {
    stack.push([async]);
  }
  return value;
};
var __callDispose = (stack, error, hasError) => {
  var E = typeof SuppressedError === "function" ? SuppressedError : function(e, s, m, _) {
    return _ = Error(m), _.name = "SuppressedError", _.error = e, _.suppressed = s, _;
  };
  var fail = (e) => error = hasError ? new E(e, error, "An error was suppressed during disposal") : (hasError = true, e);
  var next = (it) => {
    while (it = stack.pop()) {
      try {
        var result = it[1] && it[1].call(it[2]);
        if (it[0]) return Promise.resolve(result).then(next, (e) => (fail(e), next()));
      } catch (e) {
        fail(e);
      }
    }
    if (hasError) throw error;
  };
  return next();
};
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { BrowserElementSelectionMode } from "../common/browserView.js";
import { collapseToShorthands, formatMatchedStyles, keyComputedProperties } from "../common/cssHelpers.js";
const inspectHighlightConfig = {
  showInfo: true,
  showRulers: false,
  showStyles: true,
  showAccessibilityInfo: true,
  showExtensionLines: false,
  contrastAlgorithm: "aa",
  contentColor: { r: 173, g: 216, b: 255, a: 0.8 },
  paddingColor: { r: 150, g: 200, b: 255, a: 0.5 },
  borderColor: { r: 120, g: 180, b: 255, a: 0.7 },
  marginColor: { r: 200, g: 220, b: 255, a: 0.4 },
  eventTargetColor: { r: 130, g: 160, b: 255, a: 0.8 },
  shapeColor: { r: 130, g: 160, b: 255, a: 0.8 },
  shapeMarginColor: { r: 130, g: 160, b: 255, a: 0.5 },
  gridHighlightConfig: {
    rowGapColor: { r: 140, g: 190, b: 255, a: 0.3 },
    rowHatchColor: { r: 140, g: 190, b: 255, a: 0.7 },
    columnGapColor: { r: 140, g: 190, b: 255, a: 0.3 },
    columnHatchColor: { r: 140, g: 190, b: 255, a: 0.7 },
    rowLineColor: { r: 120, g: 180, b: 255 },
    columnLineColor: { r: 120, g: 180, b: 255 },
    rowLineDash: true,
    columnLineDash: true
  },
  flexContainerHighlightConfig: {
    containerBorder: { color: { r: 120, g: 180, b: 255 }, pattern: "solid" },
    itemSeparator: { color: { r: 140, g: 190, b: 255 }, pattern: "solid" },
    lineSeparator: { color: { r: 140, g: 190, b: 255 }, pattern: "solid" },
    mainDistributedSpace: { hatchColor: { r: 140, g: 190, b: 255, a: 0.7 }, fillColor: { r: 140, g: 190, b: 255, a: 0.4 } },
    crossDistributedSpace: { hatchColor: { r: 140, g: 190, b: 255, a: 0.7 }, fillColor: { r: 140, g: 190, b: 255, a: 0.4 } },
    rowGapSpace: { hatchColor: { r: 140, g: 190, b: 255, a: 0.7 }, fillColor: { r: 140, g: 190, b: 255, a: 0.4 } },
    columnGapSpace: { hatchColor: { r: 140, g: 190, b: 255, a: 0.7 }, fillColor: { r: 140, g: 190, b: 255, a: 0.4 } }
  },
  flexItemHighlightConfig: {
    baseSizeBox: { hatchColor: { r: 130, g: 170, b: 255, a: 0.6 } },
    baseSizeBorder: { color: { r: 120, g: 180, b: 255 }, pattern: "solid" },
    flexibilityArrow: { color: { r: 130, g: 190, b: 255 } }
  }
};
function useScopedDisposal() {
  const store = new DisposableStore();
  store[Symbol.dispose] = () => store.dispose();
  return store;
}
class BrowserViewFrameInspector extends Disposable {
  /**
   * @param connection The CDP session that owns this frame's target.
   * @param frame The Electron WebFrameMain for this frame.
   * @param _uniqueContextId The unique execution context ID for Runtime calls in this frame.
   * @param _frameId The CDP frame ID for this frame.
   */
  constructor(connection, frame, _uniqueContextId, _frameId) {
    super();
    this.connection = connection;
    this.frame = frame;
    this._uniqueContextId = _uniqueContextId;
    this._frameId = _frameId;
    this._isDisposed = false;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this._onDidInspectElement = this._register(new Emitter());
    this.onDidInspectElement = this._onDidInspectElement.event;
    this._onDidRemoveElementComment = this._register(new Emitter());
    this.onDidRemoveElementComment = this._onDidRemoveElementComment.event;
    this._onDidStopPicking = this._register(new Emitter());
    this.onDidStopPicking = this._onDidStopPicking.event;
    this._isPaused = false;
    this._activeInspection = this._register(new MutableDisposable());
    this._register(connection.onClose(() => {
      this.dispose();
    }));
    this._register(connection.onEvent(async (event) => {
      switch (event.method) {
        case "Overlay.inspectNodeRequested": {
          const params = event.params;
          if (params?.backendNodeId && this.isInspecting) {
            try {
              const { node } = await this.connection.sendCommand("DOM.describeNode", {
                backendNodeId: params.backendNodeId
              });
              if (node.frameId && node.frameId !== this._frameId) {
                break;
              }
              const nodeData = await this.extractNodeData({ backendNodeId: params.backendNodeId });
              this._onDidInspectElement.fire(nodeData);
            } catch {
            }
          }
          break;
        }
        case "Debugger.paused":
          this._isPaused = true;
          break;
        case "Debugger.resumed":
          this._isPaused = false;
          break;
      }
    }));
    const onPicked = async (event, result) => {
      if (!result?.elementId || event.senderFrame !== this.frame) {
        return;
      }
      try {
        const nodeData = await this.extractNodeDataById(result.elementId);
        this._onDidInspectElement.fire({ ...nodeData, elementId: result.elementId, comment: result.comment });
      } catch {
        this._updateElementComments({ pendingCommentIdsToDiscard: [result.elementId] });
      }
    };
    frame.ipc.on("vscode:browserView:elementPicked", onPicked);
    this._register({ dispose: () => frame.ipc.removeListener("vscode:browserView:elementPicked", onPicked) });
    const onCommentRemoved = (event, elementId) => {
      if (elementId && event.senderFrame === this.frame) {
        this._onDidRemoveElementComment.fire(elementId);
      }
    };
    frame.ipc.on("vscode:browserView:elementCommentRemoved", onCommentRemoved);
    this._register({ dispose: () => frame.ipc.removeListener("vscode:browserView:elementCommentRemoved", onCommentRemoved) });
    const onPickStopped = (event) => {
      if (event.senderFrame !== this.frame) {
        return;
      }
      this._onDidStopPicking.fire();
    };
    frame.ipc.on("vscode:browserView:elementPickStopped", onPickStopped);
    this._register({ dispose: () => frame.ipc.removeListener("vscode:browserView:elementPickStopped", onPickStopped) });
    this._enableDomains().catch(() => {
    });
  }
  /** Whether this frame's JavaScript execution is currently paused by the debugger. */
  get isPaused() {
    return this._isPaused;
  }
  /** Whether element inspection is currently active on this frame. */
  get isInspecting() {
    return !!this._activeInspection.value;
  }
  /** The CDP frame ID for this frame. */
  get frameId() {
    return this._frameId;
  }
  async _enableDomains() {
    await this.connection.sendCommand("DOM.enable");
    await this.connection.sendCommand("Overlay.enable");
    await this.connection.sendCommand("CSS.enable");
    await this.connection.sendCommand("Runtime.enable");
    await this.connection.sendCommand("Page.enable");
  }
  dispose() {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._onWillDispose.fire();
    super.dispose();
  }
  /**
   * Send the theme to this frame's preload.
   */
  setTheme(theme) {
    this.frame.postMessage("vscode:browserView:setTheme", theme);
  }
  /**
   * Start element inspection on this frame.
   * Uses CDP inspect mode if paused, otherwise the preload picker.
   * Stores a disposable so stop always tears down the correct mode.
   */
  async startInspection(options) {
    const mode = this._isPaused && options.mode !== BrowserElementSelectionMode.Comment ? "cdp" : "preload";
    if (this._activeInspection.value?.mode === mode) {
      if (mode === "preload") {
        this.frame.postMessage("vscode:browserView:startElementPicker", options);
      }
      return;
    }
    await this._stopInspection();
    if (mode === "cdp") {
      await this.connection.sendCommand("Overlay.setInspectMode", {
        mode: "searchForNode",
        highlightConfig: inspectHighlightConfig
      });
      const stop = async () => {
        if (this.frame.isDestroyed()) {
          return;
        }
        try {
          await this.connection.sendCommand("Overlay.setInspectMode", {
            mode: "none",
            highlightConfig: { showInfo: false, showStyles: false }
          });
          await this.connection.sendCommand("Overlay.hideHighlight");
        } catch {
        }
      };
      this._activeInspection.value = {
        mode,
        stop,
        dispose: () => {
          void stop();
        }
      };
    } else {
      this.frame.postMessage("vscode:browserView:startElementPicker", options);
      const stop = async () => {
        if (!this.frame.isDestroyed()) {
          this.frame.postMessage("vscode:browserView:stopElementPicker", {});
        }
      };
      this._activeInspection.value = {
        mode,
        stop,
        dispose: () => {
          void stop();
        }
      };
    }
  }
  async _stopInspection() {
    const activeInspection = this._activeInspection.value;
    if (activeInspection) {
      this._activeInspection.clearAndLeak();
      await activeInspection.stop();
    }
  }
  /**
   * Stop element inspection on this frame.
   */
  async stopInspection() {
    await this._stopInspection();
  }
  setElementComments(update) {
    this._updateElementComments(update);
  }
  _updateElementComments(update) {
    if (!this.frame.isDestroyed()) {
      this.frame.postMessage("vscode:browserView:setElementComments", update);
    }
  }
  /**
   * Resolve an element by its preload-tracked id and extract full node data.
   */
  async extractNodeDataById(elementId) {
    const { result } = await this.connection.sendCommand("Runtime.evaluate", {
      expression: `window.__vscode_helpers?.getElement(${JSON.stringify(elementId)})`,
      returnByValue: false,
      uniqueContextId: this._uniqueContextId
    });
    if (!result?.objectId) {
      throw new Error(`Element not found: ${elementId}`);
    }
    return this.extractNodeData({ objectId: result.objectId });
  }
  /**
   * Extract full element data from a CDP node reference.
   */
  async extractNodeData(id) {
    const data = await extractNodeData(this.connection, id);
    return { ...data, url: this.frame.url };
  }
  /**
   * Get the visual viewport scale for this frame.
   */
  async getVisualViewportScale() {
    try {
      const result = await this.connection.sendCommand("Page.getLayoutMetrics");
      if (typeof result.cssVisualViewport?.scale === "number") {
        const scale = Number(result.cssVisualViewport.scale);
        if (Number.isFinite(scale) && scale > 0) {
          return scale;
        }
      }
    } catch {
    }
    return 1;
  }
  /**
   * Create a handle to an element tracked by the preload script.
   */
  getElementHandle(elementId) {
    let disposed = false;
    return {
      addToChat: async () => {
        const nodeData = await this.extractNodeDataById(elementId);
        this._onDidInspectElement.fire(nodeData);
      },
      addComment: () => {
        this.frame.postMessage("vscode:browserView:showElementComment", { elementId });
      },
      highlight: async () => {
        this.frame.postMessage("vscode:browserView:highlightElement", { elementId });
      },
      hideHighlight: async () => {
        this.frame.postMessage("vscode:browserView:hideHighlight", {});
      },
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        this.frame.postMessage("vscode:browserView:hideHighlight", {});
      }
    };
  }
}
async function extractNodeData(connection, id) {
  var _stack = [];
  try {
    const store = __using(_stack, useScopedDisposal());
    const discoveredNodesByNodeId = {};
    store.add(connection.onEvent((event) => {
      if (event.method === "DOM.setChildNodes") {
        const { nodes } = event.params;
        for (const node2 of nodes) {
          discoveredNodesByNodeId[node2.nodeId] = node2;
          if (node2.children) {
            for (const child of node2.children) {
              discoveredNodesByNodeId[child.nodeId] = {
                ...child,
                parentId: node2.nodeId
              };
            }
          }
          if (node2.pseudoElements) {
            for (const pseudo of node2.pseudoElements) {
              discoveredNodesByNodeId[pseudo.nodeId] = {
                ...pseudo,
                parentId: node2.nodeId
              };
            }
          }
        }
      }
    }));
    await connection.sendCommand("DOM.getDocument");
    const { node } = await connection.sendCommand("DOM.describeNode", id);
    if (!node) {
      throw new Error("Failed to describe node.");
    }
    let nodeId = node.nodeId;
    if (!nodeId) {
      const { nodeIds } = await connection.sendCommand("DOM.pushNodesByBackendIdsToFrontend", { backendNodeIds: [node.backendNodeId] });
      if (!nodeIds?.length) {
        throw new Error("Failed to get node ID.");
      }
      nodeId = nodeIds[0];
    }
    const { model } = await connection.sendCommand("DOM.getBoxModel", { nodeId });
    if (!model) {
      throw new Error("Failed to get box model.");
    }
    const content = model.content;
    const margin = model.margin;
    const x = Math.min(margin[0], content[0]);
    const y = Math.min(margin[1], content[1]);
    const width = Math.max(margin[2] - margin[0], content[2] - content[0]);
    const height = Math.max(margin[5] - margin[1], content[5] - content[1]);
    const matched = await connection.sendCommand("CSS.getMatchedStylesForNode", { nodeId });
    if (!matched) {
      throw new Error("Failed to get matched css.");
    }
    const { rulesText, referencedVars, authorPropertyNames, userAgentPropertyNames } = formatMatchedStyles(matched);
    const { outerHTML } = await connection.sendCommand("DOM.getOuterHTML", { nodeId });
    if (!outerHTML) {
      throw new Error("Failed to get outerHTML.");
    }
    const attributes = attributeArrayToRecord(node.attributes);
    const ancestors = [];
    let currentNode = discoveredNodesByNodeId[nodeId] ?? node;
    while (currentNode) {
      const attributes2 = attributeArrayToRecord(currentNode.attributes);
      ancestors.unshift({
        tagName: currentNode.localName,
        id: attributes2.id,
        classNames: attributes2.class?.trim().split(/\s+/).filter(Boolean)
      });
      currentNode = currentNode.parentId ? discoveredNodesByNodeId[currentNode.parentId] : void 0;
    }
    let computedStyle = rulesText;
    let computedStyles;
    try {
      const { computedStyle: computedStyleArray } = await connection.sendCommand("CSS.getComputedStyleForNode", { nodeId });
      if (computedStyleArray) {
        computedStyles = {};
        const resolvedMap = /* @__PURE__ */ new Map();
        const varLines = [];
        for (const prop of computedStyleArray) {
          if (!prop.name || typeof prop.value !== "string") {
            continue;
          }
          if (referencedVars.has(prop.name) || keyComputedProperties.has(prop.name)) {
            computedStyles[prop.name] = prop.value;
          }
          if (authorPropertyNames.has(prop.name)) {
            resolvedMap.set(prop.name, prop.value);
          } else if (userAgentPropertyNames.has(prop.name)) {
            resolvedMap.set(prop.name, `${prop.value} /*UA*/`);
          }
          if (referencedVars.has(prop.name)) {
            varLines.push(`${prop.name}: ${prop.value};`);
          }
        }
        if (resolvedMap.size > 0) {
          const resolvedLines = collapseToShorthands(resolvedMap);
          computedStyle += "\n\n/* Resolved values */\n" + resolvedLines.join("\n");
        }
        if (varLines.length > 0) {
          computedStyle += "\n\n/* CSS variables */\n" + varLines.join("\n");
        }
      }
    } catch {
    }
    return {
      outerHTML,
      computedStyle,
      bounds: { x, y, width, height },
      ancestors,
      attributes,
      computedStyles,
      dimensions: { top: y, left: x, width, height }
    };
  } catch (_) {
    var _error = _, _hasError = true;
  } finally {
    __callDispose(_stack, _error, _hasError);
  }
}
function attributeArrayToRecord(attributes) {
  const record = {};
  for (let i = 0; i < attributes.length; i += 2) {
    const name = attributes[i];
    const value = attributes[i + 1];
    record[name] = value;
  }
  return record;
}
export {
  BrowserViewFrameInspector,
  extractNodeData,
  inspectHighlightConfig
};
