import * as errors from "./errors.js";
import * as platform from "./platform.js";
import { equalsIgnoreCase, startsWithIgnoreCase } from "./strings.js";
import { URI } from "./uri.js";
import * as paths from "./path.js";
var Schemas;
((Schemas2) => {
  Schemas2.inMemory = "inmemory";
  Schemas2.vscode = "vscode";
  Schemas2.internal = "private";
  Schemas2.walkThrough = "walkThrough";
  Schemas2.walkThroughSnippet = "walkThroughSnippet";
  Schemas2.http = "http";
  Schemas2.https = "https";
  Schemas2.file = "file";
  Schemas2.mailto = "mailto";
  Schemas2.untitled = "untitled";
  Schemas2.data = "data";
  Schemas2.command = "command";
  Schemas2.vscodeRemote = "vscode-remote";
  Schemas2.vscodeRemoteResource = "vscode-remote-resource";
  Schemas2.vscodeManagedRemoteResource = "vscode-managed-remote-resource";
  Schemas2.vscodeUserData = "vscode-userdata";
  Schemas2.vscodeCustomEditor = "vscode-custom-editor";
  Schemas2.vscodeNotebookCell = "vscode-notebook-cell";
  Schemas2.vscodeNotebookCellMetadata = "vscode-notebook-cell-metadata";
  Schemas2.vscodeNotebookCellMetadataDiff = "vscode-notebook-cell-metadata-diff";
  Schemas2.vscodeNotebookCellOutput = "vscode-notebook-cell-output";
  Schemas2.vscodeNotebookCellOutputDiff = "vscode-notebook-cell-output-diff";
  Schemas2.vscodeNotebookMetadata = "vscode-notebook-metadata";
  Schemas2.vscodeInteractiveInput = "vscode-interactive-input";
  Schemas2.vscodeSettings = "vscode-settings";
  Schemas2.vscodeWorkspaceTrust = "vscode-workspace-trust";
  Schemas2.vscodeTerminal = "vscode-terminal";
  Schemas2.vscodeImageCarousel = "vscode-image-carousel";
  Schemas2.vscodeChatCodeBlock = "vscode-chat-code-block";
  Schemas2.vscodeChatCodeCompareBlock = "vscode-chat-code-compare-block";
  Schemas2.vscodeChatEditor = "vscode-chat-editor";
  Schemas2.vscodeChatInput = "chatSessionInput";
  Schemas2.vscodeLocalChatSession = "vscode-chat-session";
  Schemas2.webviewPanel = "webview-panel";
  Schemas2.vscodeWebview = "vscode-webview";
  Schemas2.vscodeBrowser = "vscode-browser";
  Schemas2.extension = "extension";
  Schemas2.vscodeFileResource = "vscode-file";
  Schemas2.tmp = "tmp";
  Schemas2.vsls = "vsls";
  Schemas2.vscodeSourceControl = "vscode-scm";
  Schemas2.commentsInput = "comment";
  Schemas2.codeSetting = "code-setting";
  Schemas2.outputChannel = "output";
  Schemas2.accessibleView = "accessible-view";
  Schemas2.chatEditingSnapshotScheme = "chat-editing-snapshot-text-model";
  Schemas2.chatEditingModel = "chat-editing-text-model";
  Schemas2.copilotPr = "copilot-pr";
})(Schemas || (Schemas = {}));
function matchesScheme(target, scheme) {
  if (URI.isUri(target)) {
    return equalsIgnoreCase(target.scheme, scheme);
  } else {
    return startsWithIgnoreCase(target, scheme + ":");
  }
}
function matchesSomeScheme(target, ...schemes) {
  return schemes.some((scheme) => matchesScheme(target, scheme));
}
const connectionTokenCookieName = "vscode-tkn";
const connectionTokenQueryName = "tkn";
class RemoteAuthoritiesImpl {
  constructor() {
    this._hosts = /* @__PURE__ */ Object.create(null);
    this._ports = /* @__PURE__ */ Object.create(null);
    this._connectionTokens = /* @__PURE__ */ Object.create(null);
    this._preferredWebSchema = "http";
    this._delegate = null;
    this._serverRootPath = "/";
  }
  setPreferredWebSchema(schema) {
    this._preferredWebSchema = schema;
  }
  setDelegate(delegate) {
    this._delegate = delegate;
  }
  setServerRootPath(product, serverBasePath) {
    this._serverRootPath = paths.posix.join(serverBasePath ?? "/", getServerProductSegment(product));
  }
  getServerRootPath() {
    return this._serverRootPath;
  }
  get _remoteResourcesPath() {
    return paths.posix.join(this._serverRootPath, Schemas.vscodeRemoteResource);
  }
  set(authority, host, port) {
    this._hosts[authority] = host;
    this._ports[authority] = port;
  }
  setConnectionToken(authority, connectionToken) {
    this._connectionTokens[authority] = connectionToken;
  }
  getPreferredWebSchema() {
    return this._preferredWebSchema;
  }
  rewrite(uri) {
    if (this._delegate) {
      try {
        return this._delegate(uri);
      } catch (err) {
        errors.onUnexpectedExternalError(err);
        return uri;
      }
    }
    const authority = uri.authority;
    let host = this._hosts[authority];
    if (host && host.indexOf(":") !== -1 && host.indexOf("[") === -1) {
      host = `[${host}]`;
    }
    const port = this._ports[authority];
    const connectionToken = this._connectionTokens[authority];
    let query = `path=${encodeURIComponent(uri.path)}`;
    if (typeof connectionToken === "string") {
      query += `&${connectionTokenQueryName}=${encodeURIComponent(connectionToken)}`;
    }
    return URI.from({
      scheme: platform.isWeb ? this._preferredWebSchema : Schemas.vscodeRemoteResource,
      authority: `${host}:${port}`,
      path: this._remoteResourcesPath,
      query
    });
  }
}
const RemoteAuthorities = new RemoteAuthoritiesImpl();
function getServerProductSegment(product) {
  return `${product.quality ?? "oss"}-${product.commit ?? "dev"}`;
}
const builtinExtensionsPath = "vs/../../extensions";
const nodeModulesPath = "vs/../../node_modules";
const nodeModulesAsarPath = "vs/../../node_modules.asar";
const nodeModulesAsarUnpackedPath = "vs/../../node_modules.asar.unpacked";
const VSCODE_AUTHORITY = "vscode-app";
class FileAccessImpl {
  static {
    this.FALLBACK_AUTHORITY = VSCODE_AUTHORITY;
  }
  /**
   * Returns a URI to use in contexts where the browser is responsible
   * for loading (e.g. fetch()) or when used within the DOM.
   *
   * **Note:** use `dom.ts#asCSSUrl` whenever the URL is to be used in CSS context.
   */
  asBrowserUri(resourcePath) {
    const uri = this.toUri(resourcePath);
    return this.uriToBrowserUri(uri);
  }
  /**
   * Returns a URI to use in contexts where the browser is responsible
   * for loading (e.g. fetch()) or when used within the DOM.
   *
   * **Note:** use `dom.ts#asCSSUrl` whenever the URL is to be used in CSS context.
   */
  uriToBrowserUri(uri) {
    if (uri.scheme === Schemas.vscodeRemote) {
      return RemoteAuthorities.rewrite(uri);
    }
    if (
      // ...only ever for `file` resources
      uri.scheme === Schemas.file && // ...and we run in native environments
      (platform.isNative || // ...or web worker extensions on desktop
      platform.webWorkerOrigin === `${Schemas.vscodeFileResource}://${FileAccessImpl.FALLBACK_AUTHORITY}`)
    ) {
      return uri.with({
        scheme: Schemas.vscodeFileResource,
        // We need to provide an authority here so that it can serve
        // as origin for network and loading matters in chromium.
        // If the URI is not coming with an authority already, we
        // add our own
        authority: uri.authority || FileAccessImpl.FALLBACK_AUTHORITY,
        query: null,
        fragment: null
      });
    }
    return uri;
  }
  /**
   * Returns the `file` URI to use in contexts where node.js
   * is responsible for loading.
   */
  asFileUri(resourcePath) {
    const uri = this.toUri(resourcePath);
    return this.uriToFileUri(uri);
  }
  /**
   * Returns the `file` URI to use in contexts where node.js
   * is responsible for loading.
   */
  uriToFileUri(uri) {
    if (uri.scheme === Schemas.vscodeFileResource) {
      return uri.with({
        scheme: Schemas.file,
        // Only preserve the `authority` if it is different from
        // our fallback authority. This ensures we properly preserve
        // Windows UNC paths that come with their own authority.
        authority: uri.authority !== FileAccessImpl.FALLBACK_AUTHORITY ? uri.authority : null,
        query: null,
        fragment: null
      });
    }
    return uri;
  }
  toUri(uriOrModule) {
    if (URI.isUri(uriOrModule)) {
      return uriOrModule;
    }
    if (globalThis._VSCODE_FILE_ROOT) {
      const rootUriOrPath = globalThis._VSCODE_FILE_ROOT;
      if (/^\w[\w\d+.-]*:\/\//.test(rootUriOrPath)) {
        return URI.joinPath(URI.parse(rootUriOrPath, true), uriOrModule);
      }
      const modulePath = paths.join(rootUriOrPath, uriOrModule);
      return URI.file(modulePath);
    }
    throw new Error("Cannot determine URI for module id!");
  }
}
const FileAccess = new FileAccessImpl();
const CacheControlheaders = Object.freeze({
  "Cache-Control": "no-cache, no-store"
});
const DocumentPolicyheaders = Object.freeze({
  "Document-Policy": "include-js-call-stacks-in-crash-reports"
});
var COI;
((COI2) => {
  const coiHeaders = /* @__PURE__ */ new Map([
    ["1", { "Cross-Origin-Opener-Policy": "same-origin" }],
    ["2", { "Cross-Origin-Embedder-Policy": "require-corp" }],
    ["3", { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" }]
  ]);
  COI2.CoopAndCoep = Object.freeze(coiHeaders.get("3"));
  const coiSearchParamName = "vscode-coi";
  function getHeadersFromQuery(url) {
    let params;
    if (typeof url === "string") {
      params = new URL(url).searchParams;
    } else if (url instanceof URL) {
      params = url.searchParams;
    } else if (URI.isUri(url)) {
      params = new URL(url.toString(true)).searchParams;
    }
    const value = params?.get(coiSearchParamName);
    if (!value) {
      return void 0;
    }
    return coiHeaders.get(value);
  }
  COI2.getHeadersFromQuery = getHeadersFromQuery;
  function addSearchParam(urlOrSearch, coop, coep) {
    if (!globalThis.crossOriginIsolated) {
      return;
    }
    const value = coop && coep ? "3" : coep ? "2" : "1";
    if (urlOrSearch instanceof URLSearchParams) {
      urlOrSearch.set(coiSearchParamName, value);
    } else {
      urlOrSearch[coiSearchParamName] = value;
    }
  }
  COI2.addSearchParam = addSearchParam;
})(COI || (COI = {}));
export {
  COI,
  CacheControlheaders,
  DocumentPolicyheaders,
  FileAccess,
  RemoteAuthorities,
  Schemas,
  VSCODE_AUTHORITY,
  builtinExtensionsPath,
  connectionTokenCookieName,
  connectionTokenQueryName,
  getServerProductSegment,
  matchesScheme,
  matchesSomeScheme,
  nodeModulesAsarPath,
  nodeModulesAsarUnpackedPath,
  nodeModulesPath
};
