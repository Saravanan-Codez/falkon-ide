import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../base/common/lifecycle.js";
import { BrowserElementSelectionMode } from "../common/browserView.js";
import { BrowserViewFrameInspector } from "./browserViewFrameInspector.js";
import { localize } from "../../../nls.js";
const localizedStrings = {
  addComment: localize("browserView.addComment", "Add Comment"),
  addCommentPlaceholder: localize("browserView.addCommentPlaceholder", "Add a comment"),
  commentOnSelectedElement: localize("browserView.commentOnSelectedElement", "Comment on selected element"),
  elementComment: localize("browserView.elementComment", "Element comment {0}"),
  elementCommentWithBody: localize("browserView.elementCommentWithBody", "Element comment {0}: {1}"),
  emptyElementComment: localize("browserView.emptyElementComment", "Empty element comment {0}"),
  removeComment: localize("browserView.removeComment", "Remove Comment"),
  removeElementComment: localize("browserView.removeElementComment", "Remove element comment")
};
var BrowserViewInspectElementId = /* @__PURE__ */ ((BrowserViewInspectElementId2) => {
  BrowserViewInspectElementId2["Active"] = "active";
  BrowserViewInspectElementId2["ContextMenuTarget"] = "context-menu-target";
  return BrowserViewInspectElementId2;
})(BrowserViewInspectElementId || {});
class BrowserViewInspector extends Disposable {
  constructor(browser) {
    super();
    this.browser = browser;
    this._onDidSelectElement = this._register(new Emitter());
    this.onDidSelectElement = this._onDidSelectElement.event;
    this._onDidRemoveElementComment = this._register(new Emitter());
    this.onDidRemoveElementComment = this._onDidRemoveElementComment.event;
    this._onDidChangeElementSelectionState = this._register(new Emitter());
    this.onDidChangeElementSelectionState = this._onDidChangeElementSelectionState.event;
    this._elementSelectionActive = false;
    this._activeSelection = this._register(new MutableDisposable());
    this._inspectionOperation = Promise.resolve();
    this._theme = {};
    // Area selection — drag-to-select a rectangle on the top frame.
    // `onDidPickArea` fires exactly once per session, terminating it.
    // The rectangle is undefined when the picker is cancelled (ESC, zero-area drag,
    // external toggle off, navigation, or supersession by element selection).
    // Consumers should listen to this single event instead of trying to reconcile
    // rect vs. activation events across the IPC boundary — those two events travel
    // through separate channels and can be delivered out of order.
    this._onDidPickArea = this._register(new Emitter());
    this.onDidPickArea = this._onDidPickArea.event;
    this._onDidChangeAreaSelectionActive = this._register(new Emitter());
    this.onDidChangeAreaSelectionActive = this._onDidChangeAreaSelectionActive.event;
    this._areaSelectionActive = false;
    this._activeAreaSelection = this._register(new MutableDisposable());
    this._registry = this._register(new FrameInspectorRegistry());
    const webContents = this.browser.webContents;
    this._register(this._registry.onDidAdopt((inspector) => this._onInspectorAdopted(inspector)));
    const onNavigated = () => {
      this._activeSelection.clear();
      this._activeAreaSelection.clear();
    };
    webContents.on("did-navigate", onNavigated);
    this._register({ dispose: () => webContents.removeListener("did-navigate", onNavigated) });
    const onIpcMessage = (_event, channel, ...args) => {
      const senderFrame = _event.senderFrame;
      if (channel === "vscode:browserView:preloadReady") {
        if (!senderFrame) {
          return;
        }
        const frameToken = args[0];
        if (!frameToken) {
          return;
        }
        senderFrame.postMessage("vscode:browserView:setTheme", this._theme);
        senderFrame.postMessage("vscode:browserView:setLocalizedStrings", localizedStrings);
        this._registry.notifyFrameReady(senderFrame, frameToken);
        if (senderFrame === webContents.mainFrame && this._activeAreaSelection.value) {
          try {
            senderFrame.postMessage("vscode:browserView:startAreaPicker", void 0);
          } catch {
          }
        }
      } else if (channel === "vscode:browserView:areaPicked") {
        if (senderFrame !== webContents.mainFrame) {
          return;
        }
        const rect = args[0];
        const validRect = rect && rect.width > 0 && rect.height > 0 ? rect : void 0;
        this._finishAreaPick(validRect);
      } else if (channel === "vscode:browserView:areaPickStopped") {
        if (senderFrame !== webContents.mainFrame) {
          return;
        }
        this._finishAreaPick(void 0);
      }
    };
    webContents.on("ipc-message", onIpcMessage);
    this._register({ dispose: () => webContents.removeListener("ipc-message", onIpcMessage) });
    this._register(this.browser.debugger.onTargetDiscovered(async ({ targetId, type }) => {
      if (type === "iframe") {
        try {
          const session = await this.browser.debugger.attachToTarget(targetId);
          this._watchSession(session);
        } catch {
          return;
        }
      }
    }));
    this.browser.debugger.attach().then((conn) => this._watchSession(conn)).catch(() => {
    });
  }
  get isElementSelectionActive() {
    return this._elementSelectionActive;
  }
  get elementSelectionState() {
    return {
      active: this._elementSelectionActive,
      options: this._activeSelection.value?.options ?? {}
    };
  }
  get isAreaSelectionActive() {
    return this._areaSelectionActive;
  }
  /**
   * Watch a CDP session for execution contexts. When a default context appears,
   * probes for the preload token and correlates with the pending WebFrameMain.
   *
   * Called for every session: the main page session (sees same-origin frames)
   * and each cross-origin target session (sees only its own frame).
   */
  _watchSession(session) {
    this._register(session.onEvent(async (event) => {
      if (event.method === "Runtime.executionContextCreated") {
        const context = event.params.context;
        if (!context?.auxData?.isDefault || !context.auxData.frameId) {
          return;
        }
        const frameId = context.auxData.frameId;
        const uniqueContextId = context.uniqueId;
        try {
          const { result } = await session.sendCommand("Runtime.evaluate", {
            expression: "window.__vscode_helpers?.getFrameToken?.()",
            returnByValue: true,
            uniqueContextId
          });
          const token = result.value;
          if (!token) {
            return;
          }
          this._registry.notifyContextDiscovered(session, uniqueContextId, frameId, token);
        } catch {
        }
      } else if (event.method === "Page.frameDetached") {
        const frameId = event.params?.frameId;
        if (frameId) {
          this._registry.disposeByFrameId(frameId);
        }
      } else if (event.method === "Runtime.executionContextsCleared") {
        this._registry.disposeBySession(session);
      }
    }));
    Event.once(session.onClose)(() => {
      this._registry.disposeBySession(session);
    });
    session.sendCommand("Runtime.enable").catch(() => {
    });
    session.sendCommand("Page.enable").catch(() => {
    });
  }
  /**
   * Called by the registry when a frame inspector is fully adopted.
   * Wires its events to this orchestrator.
   */
  _onInspectorAdopted(inspector) {
    inspector.onDidInspectElement(async (nodeData) => {
      if (!this._activeSelection.value?.options?.continuous) {
        this._activeSelection.clear();
      }
      try {
        const offset = await this._getFrameOffsetInPage(inspector.frame);
        nodeData = this._offsetElementData(nodeData, offset);
      } catch {
      }
      this._onDidSelectElement.fire(nodeData);
    });
    inspector.onDidRemoveElementComment((elementId) => this._onDidRemoveElementComment.fire(elementId));
    inspector.onDidStopPicking(() => {
      this._activeSelection.clear();
    });
    if (this._activeSelection.value) {
      void this._queueInspectionOperation(async () => {
        const activeSelection = this._activeSelection.value;
        if (activeSelection) {
          await inspector.startInspection(activeSelection.options);
        }
      }).catch(() => {
      });
    }
    inspector.setTheme(this._theme);
  }
  setTheme(theme) {
    this._theme = theme;
    for (const inspector of this._registry.inspectors) {
      inspector.setTheme(theme);
    }
  }
  /**
   * Toggle element selection mode across all frames.
   */
  async toggleElementSelection(enabled, options = {}) {
    const newEnabled = enabled ?? !this._elementSelectionActive;
    if (!newEnabled) {
      this._activeSelection.clear();
      return;
    }
    this._activeAreaSelection.clear();
    const activeSelection = this._activeSelection.value;
    const updatedOptions = activeSelection ? { ...activeSelection.options, ...options } : { mode: BrowserElementSelectionMode.Select, ...options };
    if (activeSelection) {
      activeSelection.options = updatedOptions;
      try {
        if (await this._startInspection(activeSelection, updatedOptions)) {
          this._elementSelectionActive = true;
          this._onDidChangeElementSelectionState.fire({ active: true, options: updatedOptions });
        }
      } catch {
        if (this._activeSelection.value === activeSelection && activeSelection.options === updatedOptions) {
          this._activeSelection.clear();
        }
      }
      return;
    }
    const selection = {
      options: updatedOptions,
      dispose: () => {
        if (this._activeSelection.value === selection) {
          this._elementSelectionActive = false;
          this._onDidChangeElementSelectionState.fire({ active: false, options: selection.options });
          this._activeSelection.clearAndLeak();
          void this._queueInspectionOperation(async () => {
            await Promise.all([...this._registry.inspectors].map((i) => i.stopInspection()));
          }).catch(() => {
          });
        }
      }
    };
    this._activeSelection.value = selection;
    try {
      if (await this._startInspection(selection, updatedOptions)) {
        this._elementSelectionActive = true;
        this._onDidChangeElementSelectionState.fire({ active: true, options: updatedOptions });
      }
    } catch {
      if (this._activeSelection.value === selection && selection.options === updatedOptions) {
        this._activeSelection.clear();
      }
    }
  }
  async _startInspection(selection, options) {
    await this._queueInspectionOperation(async () => {
      if (this._activeSelection.value !== selection || selection.options !== options) {
        return;
      }
      await Promise.all([...this._registry.inspectors].map((i) => i.startInspection(options)));
    });
    return this._activeSelection.value === selection && selection.options === options;
  }
  _queueInspectionOperation(operation) {
    const result = this._inspectionOperation.then(operation);
    this._inspectionOperation = result.catch(() => {
    });
    return result;
  }
  setElementComments(update) {
    for (const inspector of this._registry.inspectors) {
      inspector.setElementComments(update);
    }
  }
  /**
   * Toggle drag-to-select area picking on the top frame only.
   * The picker reports the literal user-drawn rectangle (or `undefined` on cancellation)
   * via {@link onDidPickArea}; no DOM elements are inspected.
   */
  async toggleAreaSelection(enabled) {
    const newEnabled = enabled ?? !this._areaSelectionActive;
    if (newEnabled === this._areaSelectionActive) {
      return;
    }
    if (!newEnabled) {
      this._activeAreaSelection.clear();
      return;
    }
    this._activeSelection.clear();
    const mainFrame = this.browser.webContents.mainFrame;
    const start = () => {
      mainFrame.postMessage("vscode:browserView:startAreaPicker", void 0);
    };
    const stop = () => {
      try {
        mainFrame.postMessage("vscode:browserView:stopAreaPicker", void 0);
      } catch {
      }
    };
    const selection = {
      dispose: () => {
        stop();
        this._finishAreaPick(void 0);
      }
    };
    this._activeAreaSelection.value = selection;
    try {
      start();
      if (this._activeAreaSelection.value === selection) {
        this._areaSelectionActive = true;
        this._onDidChangeAreaSelectionActive.fire(true);
      }
    } catch {
      this._activeAreaSelection.clear();
    }
  }
  /**
   * Terminate the current area-pick session, firing `onDidPickArea` exactly once.
   * No-op if no session is active. Uses `clearAndLeak` to avoid recursing into
   * the IActiveSelection.dispose path.
   */
  _finishAreaPick(rect) {
    if (!this._areaSelectionActive && !this._activeAreaSelection.value) {
      return;
    }
    const wasActive = this._areaSelectionActive;
    this._areaSelectionActive = false;
    this._activeAreaSelection.clearAndLeak();
    this._onDidPickArea.fire(rect);
    if (wasActive) {
      this._onDidChangeAreaSelectionActive.fire(false);
    }
  }
  /**
   * Resolve a handle to an element. Routes to the correct frame inspector.
   */
  getElementHandle(id, frame) {
    const handle = this._registry.getByFrame(frame)?.getElementHandle(id);
    if (!handle) {
      return void 0;
    }
    let commentRequested = false;
    return {
      addToChat: () => handle.addToChat(),
      addComment: () => {
        if (commentRequested) {
          return;
        }
        commentRequested = true;
        setTimeout(() => {
          this._activeAreaSelection.clear();
          this._activeSelection.clear();
          void this._queueInspectionOperation(async () => {
            if (!this.browser.webContents.isDestroyed()) {
              this.browser.webContents.focus();
              handle.addComment();
            }
          });
        }, 0);
      },
      highlight: () => handle.highlight(),
      hideHighlight: () => handle.hideHighlight(),
      dispose: () => {
        if (!commentRequested) {
          handle.dispose();
        }
      }
    };
  }
  async getVisualViewportScale(frame = this.browser.webContents.mainFrame) {
    return this._registry.getByFrame(frame)?.getVisualViewportScale() ?? 1;
  }
  /**
   * Compute the cumulative offset of a frame relative to the top-level page.
   * Walks up the frame hierarchy using the parent's CDP session to query the
   * iframe element's box model via `DOM.getFrameOwner` + `DOM.getBoxModel`.
   * Works for both same-origin and cross-origin frames.
   */
  async _getFrameOffsetInPage(frame) {
    const mainFrame = this.browser.webContents.mainFrame;
    let x = 0;
    let y = 0;
    let current = frame;
    while (current !== mainFrame) {
      const parent = current.parent;
      if (!parent) {
        break;
      }
      const childInspector = this._registry.getByFrame(current);
      const parentInspector = this._registry.getByFrame(parent);
      if (!childInspector || !parentInspector) {
        break;
      }
      try {
        const childFrameId = childInspector.frameId;
        const frameOwner = await parentInspector.connection.sendCommand("DOM.getFrameOwner", {
          frameId: childFrameId
        });
        const boxModel = await parentInspector.connection.sendCommand("DOM.getBoxModel", {
          backendNodeId: frameOwner.backendNodeId
        });
        const content = boxModel.model.content;
        x += content[0];
        y += content[1];
      } catch {
        break;
      }
      current = parent;
    }
    return { x, y };
  }
  /**
   * Offset element data bounds by a frame offset.
   */
  _offsetElementData(data, offset) {
    if (offset.x === 0 && offset.y === 0) {
      return data;
    }
    return {
      ...data,
      bounds: {
        x: data.bounds.x + offset.x,
        y: data.bounds.y + offset.y,
        width: data.bounds.width,
        height: data.bounds.height
      }
    };
  }
}
class FrameInspectorRegistry extends Disposable {
  constructor() {
    super(...arguments);
    this._onDidAdopt = this._register(new Emitter());
    this.onDidAdopt = this._onDidAdopt.event;
    /** Pending halves waiting for their counterpart. */
    this._pendingFrames = /* @__PURE__ */ new Map();
    this._pendingSessions = /* @__PURE__ */ new Map();
    /** Adopted inspectors indexed multiple ways. */
    this._all = /* @__PURE__ */ new Set();
    this._byFrame = /* @__PURE__ */ new WeakMap();
    this._byFrameId = /* @__PURE__ */ new Map();
    this._bySession = /* @__PURE__ */ new Map();
  }
  get inspectors() {
    return this._all;
  }
  getByFrame(frame) {
    return this._byFrame.get(frame);
  }
  /**
   * Called when a preload script signals readiness with a token.
   * If a matching CDP context was already discovered, adopts immediately.
   */
  notifyFrameReady(frame, token) {
    const pending = this._pendingSessions.get(token);
    if (pending) {
      this._pendingSessions.delete(token);
      this._adopt(pending.session, pending.uniqueContextId, pending.frameId, frame);
    } else {
      this._pendingFrames.set(token, frame);
    }
  }
  /**
   * Called when a CDP execution context is discovered and its preload token probed.
   * If a matching WebFrameMain was already registered, adopts immediately.
   */
  notifyContextDiscovered(session, uniqueContextId, frameId, token) {
    const frame = this._pendingFrames.get(token);
    if (frame) {
      this._pendingFrames.delete(token);
      this._adopt(session, uniqueContextId, frameId, frame);
    } else {
      this._pendingSessions.set(token, { session, uniqueContextId, frameId });
    }
  }
  /** Dispose the inspector owning the given CDP frameId, if any. Also cleans pending entries. */
  disposeByFrameId(frameId) {
    this._byFrameId.get(frameId)?.dispose();
    for (const [token, pending] of this._pendingSessions) {
      if (pending.frameId === frameId) {
        this._pendingSessions.delete(token);
      }
    }
    for (const [token, frame] of this._pendingFrames) {
      if (frame.detached || frame.isDestroyed()) {
        this._pendingFrames.delete(token);
      }
    }
  }
  /** Dispose all inspectors whose connection is the given session and clear related pending state. */
  disposeBySession(session) {
    const set = this._bySession.get(session);
    if (set) {
      for (const inspector of [...set]) {
        inspector.dispose();
      }
    }
    for (const [token, pending] of this._pendingSessions) {
      if (pending.session === session) {
        this._pendingSessions.delete(token);
      }
    }
  }
  _adopt(session, uniqueContextId, frameId, frame) {
    if (frame.detached || frame.isDestroyed()) {
      return;
    }
    const inspector = new BrowserViewFrameInspector(session, frame, uniqueContextId, frameId);
    this._all.add(inspector);
    this._byFrame.set(frame, inspector);
    this._byFrameId.set(frameId, inspector);
    let sessionSet = this._bySession.get(session);
    if (!sessionSet) {
      sessionSet = /* @__PURE__ */ new Set();
      this._bySession.set(session, sessionSet);
    }
    sessionSet.add(inspector);
    inspector.onWillDispose(() => {
      this._all.delete(inspector);
      this._byFrame.delete(frame);
      this._byFrameId.delete(frameId);
      const s = this._bySession.get(session);
      if (s) {
        s.delete(inspector);
        if (s.size === 0) {
          this._bySession.delete(session);
        }
      }
    });
    this._onDidAdopt.fire(inspector);
  }
  dispose() {
    for (const inspector of [...this._all]) {
      inspector.dispose();
    }
    this._pendingFrames.clear();
    this._pendingSessions.clear();
    super.dispose();
  }
}
export {
  BrowserViewInspectElementId,
  BrowserViewInspector
};
