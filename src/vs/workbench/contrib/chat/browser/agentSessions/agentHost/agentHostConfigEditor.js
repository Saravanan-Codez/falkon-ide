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
import { VSBuffer } from "../../../../../../base/common/buffer.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { parse } from "../../../../../../base/common/json.js";
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../../../../base/common/lifecycle.js";
import {
  createFileSystemProviderError,
  FileChangeType,
  FileSystemProviderCapabilities,
  FileSystemProviderErrorCode,
  FileType
} from "../../../../../../platform/files/common/files.js";
import { Extensions as JSONExtensions } from "../../../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
function convertPropertySchema(schema) {
  const out = {
    type: schema.type,
    title: schema.title,
    description: schema.description,
    default: schema.default
  };
  if (schema.enum && schema.enum.length > 0) {
    out.enum = [...schema.enum];
    if (schema.enumDescriptions && schema.enumDescriptions.length > 0) {
      out.enumDescriptions = [...schema.enumDescriptions];
    }
  }
  if (schema.type === "array" && schema.items) {
    out.items = convertPropertySchema(schema.items);
  }
  if (schema.type === "object" && schema.properties) {
    const properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      properties[key] = convertPropertySchema(value);
    }
    out.properties = properties;
    if (schema.required && schema.required.length > 0) {
      out.required = [...schema.required];
    }
  }
  return out;
}
function buildAgentHostConfigJsonSchema(config, filter) {
  const properties = {};
  const required = [];
  for (const [key, schema] of Object.entries(config.schema.properties)) {
    if (!filter(key, schema)) {
      continue;
    }
    properties[key] = convertPropertySchema(schema);
    if (config.schema.required?.includes(key)) {
      required.push(key);
    }
  }
  const result = {
    type: "object",
    properties,
    additionalProperties: true
  };
  if (required.length > 0) {
    result.required = required;
  }
  return result;
}
function buildHeaderComment(locale, props) {
  const lines = [];
  lines.push(`// ${locale.header}`);
  lines.push(`// ${locale.saveHint}`);
  if (props && props.length > 0) {
    lines.push("//");
    for (const [key, schema] of props) {
      const suffix = schema.enum && schema.enum.length > 0 ? ` (${schema.enum.join(" | ")})` : "";
      const title = schema.title || key;
      lines.push(`// ${key}: ${title}${suffix}`);
      if (schema.description) {
        lines.push(`//   ${schema.description}`);
      }
    }
  }
  lines.push("");
  return lines.join("\n");
}
function serializeAgentHostConfigDocument(config, filter, locale) {
  if (!config) {
    return `${buildHeaderComment(locale, void 0)}{}
`;
  }
  const editableProps = Object.entries(config.schema.properties).filter(([key, schema]) => filter(key, schema));
  const values = {};
  for (const [key] of editableProps) {
    if (config.values[key] !== void 0) {
      values[key] = config.values[key];
    }
  }
  return `${buildHeaderComment(locale, editableProps)}${JSON.stringify(values, null, 2)}
`;
}
let AbstractAgentHostConfigFileSystemProvider = class extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this.capabilities = FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.PathCaseSensitive;
    this._onDidChangeCapabilities = this._register(new Emitter());
    this.onDidChangeCapabilities = this._onDidChangeCapabilities.event;
    this._onDidChangeFile = this._register(new Emitter());
    this.onDidChangeFile = this._onDidChangeFile.event;
  }
  /**
   * Release a target obtained from {@link _resolveTarget}. Called exactly
   * once for every resolution that returned a defined target: after
   * {@link stat}/{@link readFile}/{@link writeFile} complete (including on
   * error), and when a {@link watch} caller disposes its returned
   * disposable. Default is a no-op for targets with no per-resolution
   * ownership (e.g. a shared provider or the ambient agent host);
   * subclasses whose {@link _resolveTarget} acquires a scoped resource
   * (e.g. a refcounted subscription reference) must override this to
   * release it symmetrically.
   */
  _releaseTarget(_target, _ctx) {
  }
  /** Error to throw when {@link _resolveTarget} returns `undefined` for a parsed context. */
  _missingTargetError(_ctx) {
    return createFileSystemProviderError(`${this._schemeLabel} target is not available`, FileSystemProviderErrorCode.FileNotFound);
  }
  // ---- IFileSystemProvider ------------------------------------------------
  watch(resource, _opts) {
    const parsed = this._parseUri(resource);
    if (!parsed) {
      return Disposable.None;
    }
    const target = this._resolveTarget(parsed);
    if (!target) {
      return Disposable.None;
    }
    const watcher = this._watchChanges(target, parsed, () => {
      this._onDidChangeFile.fire([{ type: FileChangeType.UPDATED, resource }]);
    });
    return toDisposable(() => {
      watcher.dispose();
      this._releaseTarget(target, parsed);
    });
  }
  async stat(resource) {
    const { target, ctx } = this._resolveOrThrow(resource);
    try {
      const content = this._serialize(target, ctx);
      return {
        type: FileType.File,
        ctime: 0,
        mtime: 0,
        size: VSBuffer.fromString(content).byteLength,
        permissions: 0
      };
    } finally {
      this._releaseTarget(target, ctx);
    }
  }
  async readdir() {
    throw createFileSystemProviderError("readdir not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  async readFile(resource) {
    const { target, ctx } = this._resolveOrThrow(resource);
    try {
      const content = this._serialize(target, ctx);
      this._ensureSchemaRegistered(target, ctx);
      return VSBuffer.fromString(content).buffer;
    } finally {
      this._releaseTarget(target, ctx);
    }
  }
  async writeFile(resource, content, _opts) {
    const { target, ctx } = this._resolveOrThrow(resource);
    try {
      const text = VSBuffer.wrap(content).toString();
      const errors = [];
      const parsedJson = parse(text, errors);
      if (errors.length > 0) {
        throw createFileSystemProviderError(this._locale.parseError, FileSystemProviderErrorCode.Unavailable);
      }
      if (parsedJson === null || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
        throw createFileSystemProviderError(this._locale.notObject, FileSystemProviderErrorCode.Unavailable);
      }
      if (!this._hasConfig(target, ctx)) {
        this._logService.trace(`[${this._traceTag}] No config state for ${this._describeForTrace(ctx)}; ignoring write.`);
        this._onDidChangeFile.fire([{ type: FileChangeType.UPDATED, resource }]);
        return;
      }
      await this._replaceConfig(target, ctx, parsedJson);
      this._onDidChangeFile.fire([{ type: FileChangeType.UPDATED, resource }]);
    } finally {
      this._releaseTarget(target, ctx);
    }
  }
  async mkdir() {
    throw createFileSystemProviderError("mkdir not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  async delete(_resource, _opts) {
    throw createFileSystemProviderError("delete not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  async rename(_from, _to, _opts) {
    throw createFileSystemProviderError("rename not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  // ---- Helpers ------------------------------------------------------------
  _resolveOrThrow(resource) {
    const ctx = this._parseUri(resource);
    if (!ctx) {
      throw createFileSystemProviderError(`Invalid ${this._schemeLabel} URI: ${resource.toString()}`, FileSystemProviderErrorCode.FileNotFound);
    }
    const target = this._resolveTarget(ctx);
    if (!target) {
      throw this._missingTargetError(ctx);
    }
    return { target, ctx };
  }
};
AbstractAgentHostConfigFileSystemProvider = __decorateClass([
  __decorateParam(0, ILogService)
], AbstractAgentHostConfigFileSystemProvider);
class AbstractAgentHostConfigSchemaRegistrar extends Disposable {
  constructor() {
    super(...arguments);
    this._schemaRegistry = Registry.as(JSONExtensions.JSONContribution);
    /** Per-target registered-schema disposables, keyed by the settings URI string. */
    this._targetSchemas = this._register(new DisposableMap());
    /**
     * Tracks the {@link ConfigSchema} identity last used to register a schema
     * for a given settings URI so we can skip re-registration when only
     * values have changed.
     */
    this._lastSchemaIdentity = /* @__PURE__ */ new Map();
  }
  // ---- Public API ---------------------------------------------------------
  /**
   * Ensures a JSON schema is registered for the given target. Safe to
   * call repeatedly; a no-op when the cached schema identity matches.
   */
  ensureRegistered(target) {
    this._refreshSchema(target);
  }
  // ---- Protected API for subclass-driven change tracking -------------------
  /** Whether a schema is currently registered for `target`. */
  _isRegistered(target) {
    return this._lastSchemaIdentity.has(this._settingsUri(target));
  }
  _refreshSchema(target) {
    const config = this._getConfig(target);
    if (!config) {
      return;
    }
    const settingsUri = this._settingsUri(target);
    const identity = config.schema;
    if (this._lastSchemaIdentity.get(settingsUri) === identity) {
      return;
    }
    const schema = buildAgentHostConfigJsonSchema(config, this._propertyFilter());
    const schemaId = this._schemaId(target);
    this._targetSchemas.deleteAndDispose(settingsUri);
    const store = new DisposableStore();
    this._schemaRegistry.registerSchema(schemaId, schema, store);
    store.add(this._schemaRegistry.registerSchemaAssociation(schemaId, settingsUri));
    store.add(toDisposable(() => this._lastSchemaIdentity.delete(settingsUri)));
    this._targetSchemas.set(settingsUri, store);
    this._lastSchemaIdentity.set(settingsUri, identity);
  }
  _disposeSchemaForTarget(target) {
    this._targetSchemas.deleteAndDispose(this._settingsUri(target));
  }
}
export {
  AbstractAgentHostConfigFileSystemProvider,
  AbstractAgentHostConfigSchemaRegistrar,
  buildAgentHostConfigJsonSchema,
  convertPropertySchema,
  serializeAgentHostConfigDocument
};
