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
import { NotSupportedError } from "../../../../base/common/errors.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { FileChangeType, FilePermission, FileSystemProviderCapabilities, FileSystemProviderErrorCode, FileType } from "../../../../platform/files/common/files.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import * as JSONContributionRegistry from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { ILogService, LogLevel } from "../../../../platform/log/common/log.js";
import { isEqual } from "../../../../base/common/resources.js";
const schemaRegistry = Registry.as(JSONContributionRegistry.Extensions.JSONContribution);
let SettingsFileSystemProvider = class extends Disposable {
  constructor(preferencesService, logService) {
    super();
    this.preferencesService = preferencesService;
    this.logService = logService;
    this._onDidChangeFile = this._register(new Emitter());
    this.onDidChangeFile = this._onDidChangeFile.event;
    this.capabilities = FileSystemProviderCapabilities.Readonly + FileSystemProviderCapabilities.FileReadWrite;
    this.onDidChangeCapabilities = Event.None;
    this._register(schemaRegistry.onDidChangeSchema((schemaUri) => {
      this._onDidChangeFile.fire([{ resource: URI.parse(schemaUri), type: FileChangeType.UPDATED }]);
    }));
    this._register(schemaRegistry.onDidChangeSchemaAssociations(() => {
      this._onDidChangeFile.fire([{ resource: SettingsFileSystemProvider.SCHEMA_ASSOCIATIONS, type: FileChangeType.UPDATED }]);
    }));
    this._register(preferencesService.onDidDefaultSettingsContentChanged((uri) => {
      this._onDidChangeFile.fire([{ resource: uri, type: FileChangeType.UPDATED }]);
    }));
  }
  static {
    this.SCHEMA = Schemas.vscode;
  }
  static {
    this.SCHEMA_ASSOCIATIONS = URI.parse(`${Schemas.vscode}://schemas-associations/schemas-associations.json`);
  }
  async readFile(uri) {
    if (uri.scheme !== SettingsFileSystemProvider.SCHEMA) {
      throw new NotSupportedError();
    }
    let content;
    if (uri.authority === "schemas") {
      content = this.getSchemaContent(uri);
    } else if (uri.authority === SettingsFileSystemProvider.SCHEMA_ASSOCIATIONS.authority) {
      const schemas = Object.entries(schemaRegistry.getSchemaAssociations()).map(([url, fileMatch]) => ({ url, fileMatch }));
      content = JSON.stringify({ schemas });
    } else if (uri.authority === "defaultsettings") {
      content = this.preferencesService.getDefaultSettingsContent(uri);
    }
    if (content) {
      return VSBuffer.fromString(content).buffer;
    }
    throw FileSystemProviderErrorCode.FileNotFound;
  }
  async stat(uri) {
    if (schemaRegistry.hasSchemaContent(uri.toString()) || this.preferencesService.hasDefaultSettingsContent(uri)) {
      const currentTime = Date.now();
      return {
        type: FileType.File,
        permissions: FilePermission.Readonly,
        mtime: currentTime,
        ctime: currentTime,
        size: 0
      };
    }
    if (isEqual(uri, SettingsFileSystemProvider.SCHEMA_ASSOCIATIONS)) {
      const currentTime = Date.now();
      return {
        type: FileType.File,
        permissions: FilePermission.Readonly,
        mtime: currentTime,
        ctime: currentTime,
        size: 0
      };
    }
    throw FileSystemProviderErrorCode.FileNotFound;
  }
  watch(resource, opts) {
    return Disposable.None;
  }
  async mkdir(resource) {
  }
  async readdir(resource) {
    return [];
  }
  async rename(from, to, opts) {
  }
  async delete(resource, opts) {
  }
  async writeFile() {
    throw new NotSupportedError();
  }
  getSchemaContent(uri) {
    const startTime = Date.now();
    const content = schemaRegistry.getSchemaContent(uri.toString()) ?? "{}";
    const logLevel = this.logService.getLevel();
    if (logLevel === LogLevel.Debug || logLevel === LogLevel.Trace) {
      const endTime = Date.now();
      const uncompressed = JSON.stringify(schemaRegistry.getSchemaContributions().schemas[uri.toString()]);
      this.logService.debug(`${uri.toString()}: ${uncompressed.length} -> ${content.length} (${Math.round((uncompressed.length - content.length) / uncompressed.length * 100)}%) Took ${endTime - startTime}ms`);
    }
    return content;
  }
};
SettingsFileSystemProvider = __decorateClass([
  __decorateParam(0, IPreferencesService),
  __decorateParam(1, ILogService)
], SettingsFileSystemProvider);
export {
  SettingsFileSystemProvider
};
