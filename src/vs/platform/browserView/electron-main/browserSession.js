import { session } from "electron";
import { normalize } from "../../../base/common/path.js";
import { isLinux } from "../../../base/common/platform.js";
import { joinPath } from "../../../base/common/resources.js";
import { TernarySearchTree } from "../../../base/common/ternarySearchTree.js";
import { URI } from "../../../base/common/uri.js";
import { BrowserViewStorageScope } from "../common/browserView.js";
import { BrowserSessionTrust } from "./browserSessionTrust.js";
import { BrowserSessionHistory } from "./browserSessionHistory.js";
import { BrowserSessionPermissions } from "./browserSessionPermissions.js";
import { BrowserSessionRemote } from "./browserSessionRemote.js";
import { FileAccess, Schemas } from "../../../base/common/network.js";
import { localize } from "../../../nls.js";
class BrowserSession {
  /**
   * @deprecated Don't use this directly. Create sessions via the static factory methods.
   */
  constructor(id, electronSession, storageScope) {
    this.id = id;
    this.electronSession = electronSession;
    this.storageScope = storageScope;
    this._trust = new BrowserSessionTrust(this);
    this._history = new BrowserSessionHistory(this);
    this._remote = new BrowserSessionRemote(this);
    this._permissions = new BrowserSessionPermissions(this);
    this.configure();
    BrowserSession.knownSessions.add(electronSession);
    BrowserSession._bySession.set(electronSession, this);
    BrowserSession._byId.set(id, new WeakRef(this));
    BrowserSession._finalizer.register(electronSession, id);
  }
  static {
    // #region Static registry
    /**
     * Primary store — keyed by Electron session so entries are
     * automatically removed when the Electron session is GC'd.
     *
     * The goal is to ensure that BrowserSessions have the exact same lifespan as their Electron sessions.
     */
    this._bySession = /* @__PURE__ */ new WeakMap();
  }
  static {
    /**
     * String-keyed lookup for {@link get} and {@link getBrowserContextIds}.
     * Values are weak references so they don't prevent GC of the
     * {@link BrowserSession} (and transitively the Electron session).
     *
     * ID derivation rules (one-to-one with Electron sessions):
     *  - Global scope         -> `"global"`
     *  - Workspace scope      -> `"workspace:${workspaceId}"`
     *  - Ephemeral scope      -> `"ephemeral:${viewId}"` or `"${type}:${viewId}"` for custom types
     */
    this._byId = /* @__PURE__ */ new Map();
  }
  static {
    /**
     * Cleans up stale {@link _byId} entries when the Electron session
     * they point to is garbage-collected.
     */
    this._finalizer = new FinalizationRegistry((id) => {
      BrowserSession._byId.delete(id);
    });
  }
  static {
    /**
     * Weak set mirroring the Electron sessions owned by any BrowserSession.
     * Useful for quickly checking whether a given {@link Electron.WebContents}
     * belongs to the integrated browser.
     */
    this.knownSessions = /* @__PURE__ */ new WeakSet();
  }
  /**
   * Check if a {@link Electron.WebContents} belongs to an integrated browser
   * view backed by a BrowserSession.
   */
  static isBrowserViewWebContents(contents) {
    return BrowserSession.knownSessions.has(contents.session);
  }
  /**
   * Return an existing session for the given id, or `undefined`.
   */
  static get(id) {
    const ref = BrowserSession._byId.get(id);
    if (!ref) {
      return void 0;
    }
    const bs = ref.deref();
    if (!bs) {
      BrowserSession._byId.delete(id);
    }
    return bs;
  }
  /**
   * Return all live browser context IDs (i.e. all session {@link id}s).
   */
  static getBrowserContextIds() {
    const ids = [];
    for (const [id, ref] of BrowserSession._byId) {
      if (ref.deref()) {
        ids.push(id);
      } else {
        BrowserSession._byId.delete(id);
      }
    }
    return ids;
  }
  /**
   * Get or create the singleton global-scope session.
   */
  static getOrCreateGlobal(instantiationService) {
    const electronSession = session.fromPartition("persist:vscode-browser");
    return BrowserSession._bySession.get(electronSession) ?? instantiationService.createInstance(BrowserSession, "global", electronSession, BrowserViewStorageScope.Global);
  }
  /**
   * Get or create a workspace-scope session for the given workspace.
   */
  static getOrCreateWorkspace(instantiationService, workspaceId, workspaceStorageHome) {
    const storage = joinPath(workspaceStorageHome, workspaceId, "browserStorage");
    const electronSession = session.fromPath(storage.fsPath);
    return BrowserSession._bySession.get(electronSession) ?? instantiationService.createInstance(BrowserSession, `workspace:${workspaceId}`, electronSession, BrowserViewStorageScope.Workspace);
  }
  /**
   * Get or create an ephemeral session for the given view / target id.
   */
  static getOrCreateEphemeral(instantiationService, viewId, type) {
    if (type === "workspace" || type === "ephemeral") {
      throw new Error(`Cannot create session with reserved type '${type}'`);
    }
    const sessionId = `${type ?? "ephemeral"}:${viewId}`;
    const electronSession = session.fromPartition(`vscode-browser-${type}${viewId}`);
    return BrowserSession._bySession.get(electronSession) ?? instantiationService.createInstance(BrowserSession, sessionId, electronSession, BrowserViewStorageScope.Ephemeral);
  }
  /**
   * Get or create a session for a workbench-originated browser view.
   * The session id is derived from the *scope* -- not the view id -- so
   * multiple views that share a scope (e.g. two Global views) get the
   * same `BrowserSession`.
   *
   * @param instantiationService Used to construct the session and inject
   *                             its service dependencies (tunnel proxy,
   *                             log) when a new session is needed.
   * @param viewId   Used only for ephemeral sessions where every view
   *                 needs its own Electron session.
   * @param sessionOptions  Determines the storage scope for the session.
   * @param workspaceStorageHome  Root folder under which per-workspace
   *                              browser storage is created
   *                              (`IEnvironmentMainService.workspaceStorageHome`).
   * @param workspaceId  Only required when `scope` is `workspace`.
   */
  static getOrCreate(instantiationService, viewId, sessionOptions, workspaceStorageHome, workspaceId) {
    switch (sessionOptions.scope) {
      case BrowserViewStorageScope.Global:
        return BrowserSession.getOrCreateGlobal(instantiationService);
      case BrowserViewStorageScope.Workspace:
        if (workspaceId) {
          return BrowserSession.getOrCreateWorkspace(instantiationService, workspaceId, workspaceStorageHome);
        }
      // fallthrough -- no workspace context -> ephemeral
      case BrowserViewStorageScope.Ephemeral:
      default:
        return BrowserSession.getOrCreateEphemeral(instantiationService, viewId);
    }
  }
  static {
    this._trustedFileRoots = TernarySearchTree.forPaths(!isLinux);
  }
  static {
    this._trustAllFiles = false;
  }
  /**
   * Set trusted file roots for all browser sessions.
   */
  static setTrustedFileRoots(roots, trustAllFiles) {
    BrowserSession._trustAllFiles = trustAllFiles;
    BrowserSession._trustedFileRoots.clear();
    for (const root of roots) {
      if (root) {
        BrowserSession._trustedFileRoots.set(normalize(root), true);
      }
    }
  }
  /** Public trust interface for consumers that need cert operations. */
  get trust() {
    return this._trust;
  }
  /** Public history interface for consumers that record visits. */
  get history() {
    return this._history;
  }
  /** Public remote interface owning the proxy lifecycle for this session. */
  get remote() {
    return this._remote;
  }
  /** Public permissions interface owning per-origin permission state. */
  get permissions() {
    return this._permissions;
  }
  /**
   * Connect application storage to this session so that preferences
   * (trusted certificates, history, etc.) are persisted across restarts.
   * Restores any previously-saved data on first call; subsequent calls
   * are no-ops.
   */
  connectStorage(storage) {
    this._trust.connectStorage(storage);
    this._history.connectStorage(storage);
    this._permissions.connectStorage(storage);
  }
  /**
   * Apply the permission policy and preload scripts to the session.
   */
  configure() {
    this._permissions.configure(this.electronSession);
    this.electronSession.registerPreloadScript({
      type: "frame",
      filePath: FileAccess.asFileUri("vs/platform/browserView/electron-browser/preload-browserView.js").fsPath
    });
    this.electronSession.protocol.handle(Schemas.file, (request) => {
      const filePath = normalize(URI.parse(request.url).fsPath);
      if (!BrowserSession._trustAllFiles && !BrowserSession._trustedFileRoots.findSubstr(filePath)) {
        return new Response(localize("browserSession.untrustedFile", "Forbidden. File does not reside within a trusted folder."), { status: 403 });
      }
      return this.electronSession.fetch(request, { bypassCustomProtocolHandlers: true });
    });
  }
  /**
   * Clear all session data including trust state, history, and all browsing data.
   */
  async clearData() {
    await this._trust.clear();
    this._history.delete();
    this._permissions.clear();
    await this.electronSession.clearData();
  }
  // #endregion
}
export {
  BrowserSession
};
