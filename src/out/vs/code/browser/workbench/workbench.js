import { isStandalone } from "../../../base/browser/browser.js";
import { addDisposableListener } from "../../../base/browser/dom.js";
import { mainWindow } from "../../../base/browser/window.js";
import { VSBuffer, decodeBase64, encodeBase64 } from "../../../base/common/buffer.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { parse } from "../../../base/common/marshalling.js";
import { Schemas } from "../../../base/common/network.js";
import { posix } from "../../../base/common/path.js";
import { isEqual } from "../../../base/common/resources.js";
import { ltrim } from "../../../base/common/strings.js";
import { URI } from "../../../base/common/uri.js";
import product from "../../../platform/product/common/product.js";
import { isFolderToOpen, isWorkspaceToOpen } from "../../../platform/window/common/window.js";
import { create } from "../../../workbench/workbench.web.main.internal.js";
class TransparentCrypto {
  async seal(data) {
    return data;
  }
  async unseal(data) {
    return data;
  }
}
var AESConstants = /* @__PURE__ */ ((AESConstants2) => {
  AESConstants2["ALGORITHM"] = "AES-GCM";
  AESConstants2[AESConstants2["KEY_LENGTH"] = 256] = "KEY_LENGTH";
  AESConstants2[AESConstants2["IV_LENGTH"] = 12] = "IV_LENGTH";
  return AESConstants2;
})(AESConstants || {});
class NetworkError extends Error {
  constructor(inner) {
    super(inner.message);
    this.name = inner.name;
    this.stack = inner.stack;
  }
}
class ServerKeyedAESCrypto {
  constructor(authEndpoint) {
    this.authEndpoint = authEndpoint;
  }
  /**
   * Gets whether the algorithm is supported; requires a secure context
   */
  static supported() {
    return !!crypto.subtle;
  }
  async seal(data) {
    const iv = mainWindow.crypto.getRandomValues(new Uint8Array(12 /* IV_LENGTH */));
    const clientKeyObj = await mainWindow.crypto.subtle.generateKey(
      { name: "AES-GCM" /* ALGORITHM */, length: 256 /* KEY_LENGTH */ },
      true,
      ["encrypt", "decrypt"]
    );
    const clientKey = new Uint8Array(await mainWindow.crypto.subtle.exportKey("raw", clientKeyObj));
    const key = await this.getKey(clientKey);
    const dataUint8Array = new TextEncoder().encode(data);
    const cipherText = await mainWindow.crypto.subtle.encrypt(
      { name: "AES-GCM" /* ALGORITHM */, iv },
      key,
      dataUint8Array
    );
    const result = new Uint8Array([...clientKey, ...iv, ...new Uint8Array(cipherText)]);
    return encodeBase64(VSBuffer.wrap(result));
  }
  async unseal(data) {
    const dataUint8Array = decodeBase64(data);
    if (dataUint8Array.byteLength < 60) {
      throw Error("Invalid length for the value for credentials.crypto");
    }
    const keyLength = 256 /* KEY_LENGTH */ / 8;
    const clientKey = dataUint8Array.slice(0, keyLength);
    const iv = dataUint8Array.slice(keyLength, keyLength + 12 /* IV_LENGTH */);
    const cipherText = dataUint8Array.slice(keyLength + 12 /* IV_LENGTH */);
    const key = await this.getKey(clientKey.buffer);
    const decrypted = await mainWindow.crypto.subtle.decrypt(
      { name: "AES-GCM" /* ALGORITHM */, iv: iv.buffer },
      key,
      cipherText.buffer
    );
    return new TextDecoder().decode(new Uint8Array(decrypted));
  }
  /**
   * Given a clientKey, returns the CryptoKey object that is used to encrypt/decrypt the data.
   * The actual key is (clientKey XOR serverKey)
   */
  async getKey(clientKey) {
    if (!clientKey || clientKey.byteLength !== 256 /* KEY_LENGTH */ / 8) {
      throw Error("Invalid length for clientKey");
    }
    const serverKey = await this.getServerKeyPart();
    const keyData = new Uint8Array(256 /* KEY_LENGTH */ / 8);
    for (let i = 0; i < keyData.byteLength; i++) {
      keyData[i] = clientKey[i] ^ serverKey[i];
    }
    return mainWindow.crypto.subtle.importKey(
      "raw",
      keyData,
      {
        name: "AES-GCM" /* ALGORITHM */,
        length: 256 /* KEY_LENGTH */
      },
      true,
      ["encrypt", "decrypt"]
    );
  }
  async getServerKeyPart() {
    if (this.serverKey) {
      return this.serverKey;
    }
    let attempt = 0;
    let lastError;
    while (attempt <= 3) {
      try {
        const res = await fetch(this.authEndpoint, { credentials: "include", method: "POST" });
        if (!res.ok) {
          throw new Error(res.statusText);
        }
        const serverKey = new Uint8Array(await res.arrayBuffer());
        if (serverKey.byteLength !== 256 /* KEY_LENGTH */ / 8) {
          throw Error(`The key retrieved by the server is not ${256 /* KEY_LENGTH */} bit long.`);
        }
        this.serverKey = serverKey;
        return this.serverKey;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, attempt * attempt * 100));
      }
    }
    if (lastError) {
      throw new NetworkError(lastError);
    }
    throw new Error("Unknown error");
  }
}
class LocalStorageSecretStorageProvider {
  constructor(crypto2) {
    this.crypto = crypto2;
    this.storageKey = "secrets.provider";
    this.type = "persisted";
    this.secretsPromise = this.load();
  }
  async load() {
    const record = this.loadAuthSessionFromElement();
    const encrypted = localStorage.getItem(this.storageKey);
    if (encrypted) {
      try {
        const decrypted = JSON.parse(await this.crypto.unseal(encrypted));
        return { ...record, ...decrypted };
      } catch (err) {
        console.error("Failed to decrypt secrets from localStorage", err);
        if (!(err instanceof NetworkError)) {
          localStorage.removeItem(this.storageKey);
        }
      }
    }
    return record;
  }
  loadAuthSessionFromElement() {
    let authSessionInfo;
    const authSessionElement = mainWindow.document.getElementById("vscode-workbench-auth-session");
    const authSessionElementAttribute = authSessionElement ? authSessionElement.getAttribute("data-settings") : void 0;
    if (authSessionElementAttribute) {
      try {
        authSessionInfo = JSON.parse(authSessionElementAttribute);
      } catch (error) {
      }
    }
    if (!authSessionInfo) {
      return {};
    }
    const record = {};
    record[`${product.urlProtocol}.loginAccount`] = JSON.stringify(authSessionInfo);
    if (authSessionInfo.providerId !== "github") {
      console.error(`Unexpected auth provider: ${authSessionInfo.providerId}. Expected 'github'.`);
      return record;
    }
    const authAccount = JSON.stringify({ extensionId: "vscode.github-authentication", key: "github.auth" });
    record[authAccount] = JSON.stringify(authSessionInfo.scopes.map((scopes) => ({
      id: authSessionInfo.id,
      scopes,
      accessToken: authSessionInfo.accessToken
    })));
    return record;
  }
  async get(key) {
    const secrets = await this.secretsPromise;
    return secrets[key];
  }
  async set(key, value) {
    const secrets = await this.secretsPromise;
    secrets[key] = value;
    this.secretsPromise = Promise.resolve(secrets);
    this.save();
  }
  async delete(key) {
    const secrets = await this.secretsPromise;
    delete secrets[key];
    this.secretsPromise = Promise.resolve(secrets);
    this.save();
  }
  async keys() {
    const secrets = await this.secretsPromise;
    return Object.keys(secrets) || [];
  }
  async save() {
    try {
      const encrypted = await this.crypto.seal(JSON.stringify(await this.secretsPromise));
      localStorage.setItem(this.storageKey, encrypted);
    } catch (err) {
      console.error(err);
    }
  }
}
class LocalStorageURLCallbackProvider extends Disposable {
  constructor(_callbackRoute) {
    super();
    this._callbackRoute = _callbackRoute;
    this._onCallback = this._register(new Emitter());
    this.onCallback = this._onCallback.event;
    this.pendingCallbacks = /* @__PURE__ */ new Set();
    this.lastTimeChecked = Date.now();
    this.checkCallbacksTimeout = void 0;
  }
  static {
    this.REQUEST_ID = 0;
  }
  static {
    this.QUERY_KEYS = [
      "scheme",
      "authority",
      "path",
      "query",
      "fragment"
    ];
  }
  create(options = {}) {
    const id = ++LocalStorageURLCallbackProvider.REQUEST_ID;
    const queryParams = [`vscode-reqid=${id}`];
    for (const key of LocalStorageURLCallbackProvider.QUERY_KEYS) {
      const value = options[key];
      if (value) {
        queryParams.push(`vscode-${key}=${encodeURIComponent(value)}`);
      }
    }
    if (!(options.authority === "vscode.github-authentication" && options.path === "/dummy")) {
      const key = `vscode-web.url-callbacks[${id}]`;
      localStorage.removeItem(key);
      this.pendingCallbacks.add(id);
      this.startListening();
    }
    return URI.parse(mainWindow.location.href).with({ path: this._callbackRoute, query: queryParams.join("&") });
  }
  startListening() {
    if (this.onDidChangeLocalStorageDisposable) {
      return;
    }
    this.onDidChangeLocalStorageDisposable = addDisposableListener(mainWindow, "storage", () => this.onDidChangeLocalStorage());
  }
  stopListening() {
    this.onDidChangeLocalStorageDisposable?.dispose();
    this.onDidChangeLocalStorageDisposable = void 0;
  }
  // this fires every time local storage changes, but we
  // don't want to check more often than once a second
  async onDidChangeLocalStorage() {
    const ellapsed = Date.now() - this.lastTimeChecked;
    if (ellapsed > 1e3) {
      this.checkCallbacks();
    } else if (this.checkCallbacksTimeout === void 0) {
      this.checkCallbacksTimeout = setTimeout(() => {
        this.checkCallbacksTimeout = void 0;
        this.checkCallbacks();
      }, 1e3 - ellapsed);
    }
  }
  checkCallbacks() {
    let pendingCallbacks;
    for (const id of this.pendingCallbacks) {
      const key = `vscode-web.url-callbacks[${id}]`;
      const result = localStorage.getItem(key);
      if (result !== null) {
        try {
          this._onCallback.fire(URI.revive(JSON.parse(result)));
        } catch (error) {
          console.error(error);
        }
        pendingCallbacks = pendingCallbacks ?? new Set(this.pendingCallbacks);
        pendingCallbacks.delete(id);
        localStorage.removeItem(key);
      }
    }
    if (pendingCallbacks) {
      this.pendingCallbacks = pendingCallbacks;
      if (this.pendingCallbacks.size === 0) {
        this.stopListening();
      }
    }
    this.lastTimeChecked = Date.now();
  }
  dispose() {
    clearTimeout(this.checkCallbacksTimeout);
    this.stopListening();
    super.dispose();
  }
}
class WorkspaceProvider {
  constructor(workspace, payload, config) {
    this.workspace = workspace;
    this.payload = payload;
    this.config = config;
    this.trusted = true;
  }
  static {
    this.QUERY_PARAM_EMPTY_WINDOW = "ew";
  }
  static {
    this.QUERY_PARAM_FOLDER = "folder";
  }
  static {
    this.QUERY_PARAM_WORKSPACE = "workspace";
  }
  static {
    this.QUERY_PARAM_PAYLOAD = "payload";
  }
  static create(config) {
    let foundWorkspace = false;
    let workspace;
    let payload = /* @__PURE__ */ Object.create(null);
    const query = new URL(document.location.href).searchParams;
    query.forEach((value, key) => {
      switch (key) {
        // Folder
        case WorkspaceProvider.QUERY_PARAM_FOLDER:
          if (config.remoteAuthority && value.startsWith(posix.sep)) {
            workspace = { folderUri: URI.from({ scheme: Schemas.vscodeRemote, path: value, authority: config.remoteAuthority }) };
          } else {
            workspace = { folderUri: URI.parse(value) };
          }
          foundWorkspace = true;
          break;
        // Workspace
        case WorkspaceProvider.QUERY_PARAM_WORKSPACE:
          if (config.remoteAuthority && value.startsWith(posix.sep)) {
            workspace = { workspaceUri: URI.from({ scheme: Schemas.vscodeRemote, path: value, authority: config.remoteAuthority }) };
          } else {
            workspace = { workspaceUri: URI.parse(value) };
          }
          foundWorkspace = true;
          break;
        // Empty
        case WorkspaceProvider.QUERY_PARAM_EMPTY_WINDOW:
          workspace = void 0;
          foundWorkspace = true;
          break;
        // Payload
        case WorkspaceProvider.QUERY_PARAM_PAYLOAD:
          try {
            payload = parse(value);
          } catch (error) {
            console.error(error);
          }
          break;
      }
    });
    if (!foundWorkspace) {
      if (config.folderUri) {
        workspace = { folderUri: URI.revive(config.folderUri) };
      } else if (config.workspaceUri) {
        workspace = { workspaceUri: URI.revive(config.workspaceUri) };
      }
    }
    return new WorkspaceProvider(workspace, payload, config);
  }
  async open(workspace, options) {
    if (options?.reuse && !options.payload && this.isSame(this.workspace, workspace)) {
      return true;
    }
    const targetHref = this.createTargetUrl(workspace, options);
    if (targetHref) {
      if (options?.reuse) {
        mainWindow.location.href = targetHref;
        return true;
      } else {
        let result;
        if (isStandalone()) {
          result = mainWindow.open(targetHref, "_blank", "toolbar=no");
        } else {
          result = mainWindow.open(targetHref);
        }
        return !!result;
      }
    }
    return false;
  }
  createTargetUrl(workspace, options) {
    let targetHref = void 0;
    if (!workspace) {
      targetHref = `${document.location.origin}${document.location.pathname}?${WorkspaceProvider.QUERY_PARAM_EMPTY_WINDOW}=true`;
    } else if (isFolderToOpen(workspace)) {
      const queryParamFolder = this.encodeWorkspacePath(workspace.folderUri);
      targetHref = `${document.location.origin}${document.location.pathname}?${WorkspaceProvider.QUERY_PARAM_FOLDER}=${queryParamFolder}`;
    } else if (isWorkspaceToOpen(workspace)) {
      const queryParamWorkspace = this.encodeWorkspacePath(workspace.workspaceUri);
      targetHref = `${document.location.origin}${document.location.pathname}?${WorkspaceProvider.QUERY_PARAM_WORKSPACE}=${queryParamWorkspace}`;
    }
    if (options?.payload) {
      targetHref += `&${WorkspaceProvider.QUERY_PARAM_PAYLOAD}=${encodeURIComponent(JSON.stringify(options.payload))}`;
    }
    return targetHref;
  }
  encodeWorkspacePath(uri) {
    if (this.config.remoteAuthority && uri.scheme === Schemas.vscodeRemote) {
      return encodeURIComponent(`${posix.sep}${ltrim(uri.path, posix.sep)}`).replaceAll("%2F", "/");
    }
    return encodeURIComponent(uri.toString(true));
  }
  isSame(workspaceA, workspaceB) {
    if (!workspaceA || !workspaceB) {
      return workspaceA === workspaceB;
    }
    if (isFolderToOpen(workspaceA) && isFolderToOpen(workspaceB)) {
      return isEqual(workspaceA.folderUri, workspaceB.folderUri);
    }
    if (isWorkspaceToOpen(workspaceA) && isWorkspaceToOpen(workspaceB)) {
      return isEqual(workspaceA.workspaceUri, workspaceB.workspaceUri);
    }
    return false;
  }
  hasRemote() {
    if (this.workspace) {
      if (isFolderToOpen(this.workspace)) {
        return this.workspace.folderUri.scheme === Schemas.vscodeRemote;
      }
      if (isWorkspaceToOpen(this.workspace)) {
        return this.workspace.workspaceUri.scheme === Schemas.vscodeRemote;
      }
    }
    return true;
  }
}
function readCookie(name) {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    if (cookie.startsWith(name + "=")) {
      return cookie.substring(name.length + 1);
    }
  }
  return void 0;
}
(function() {
  const configElement = mainWindow.document.getElementById("vscode-workbench-web-configuration");
  const configElementAttribute = configElement ? configElement.getAttribute("data-settings") : void 0;
  if (!configElement || !configElementAttribute) {
    throw new Error("Missing web configuration element");
  }
  const config = JSON.parse(configElementAttribute);
  const secretStorageKeyPath = readCookie("vscode-secret-key-path");
  const secretStorageCrypto = secretStorageKeyPath && ServerKeyedAESCrypto.supported() ? new ServerKeyedAESCrypto(secretStorageKeyPath) : new TransparentCrypto();
  create(mainWindow.document.body, {
    ...config,
    windowIndicator: config.windowIndicator ?? { label: "$(remote)", tooltip: `${product.nameShort} Web` },
    settingsSyncOptions: config.settingsSyncOptions ? { enabled: config.settingsSyncOptions.enabled } : void 0,
    workspaceProvider: WorkspaceProvider.create(config),
    urlCallbackProvider: new LocalStorageURLCallbackProvider(config.callbackRoute),
    secretStorageProvider: config.remoteAuthority && !secretStorageKeyPath ? void 0 : new LocalStorageSecretStorageProvider(secretStorageCrypto)
  });
})();
export {
  LocalStorageSecretStorageProvider
};
