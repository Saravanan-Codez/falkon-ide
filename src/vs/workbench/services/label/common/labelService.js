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
import { localize } from "../../../../nls.js";
import { URI } from "../../../../base/common/uri.js";
import { Disposable, dispose } from "../../../../base/common/lifecycle.js";
import { posix, sep, win32 } from "../../../../base/common/path.js";
import { Emitter } from "../../../../base/common/event.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IWorkspaceContextService, isWorkspace, isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier, toWorkspaceIdentifier, WORKSPACE_EXTENSION, isUntitledWorkspace, isTemporaryWorkspace } from "../../../../platform/workspace/common/workspace.js";
import { basenameOrAuthority, basename, joinPath, dirname } from "../../../../base/common/resources.js";
import { tildify, getPathLabel } from "../../../../base/common/labels.js";
import { ILabelService, Verbosity } from "../../../../platform/label/common/label.js";
import { ExtensionsRegistry } from "../../extensions/common/extensionsRegistry.js";
import { match } from "../../../../base/common/glob.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IPathService } from "../../path/common/pathService.js";
import { isProposedApiEnabled } from "../../extensions/common/extensions.js";
import { OperatingSystem, OS } from "../../../../base/common/platform.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { Schemas } from "../../../../base/common/network.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Memento } from "../../../common/memento.js";
const resourceLabelFormattersExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "resourceLabelFormatters",
  jsonSchema: {
    description: localize("vscode.extension.contributes.resourceLabelFormatters", "Contributes resource label formatting rules."),
    type: "array",
    items: {
      type: "object",
      required: ["scheme", "formatting"],
      properties: {
        scheme: {
          type: "string",
          description: localize("vscode.extension.contributes.resourceLabelFormatters.scheme", 'URI scheme on which to match the formatter on. For example "file". Simple glob patterns are supported.')
        },
        authority: {
          type: "string",
          description: localize("vscode.extension.contributes.resourceLabelFormatters.authority", "URI authority on which to match the formatter on. Simple glob patterns are supported.")
        },
        formatting: {
          description: localize("vscode.extension.contributes.resourceLabelFormatters.formatting", "Rules for formatting uri resource labels."),
          type: "object",
          properties: {
            label: {
              type: "string",
              description: localize("vscode.extension.contributes.resourceLabelFormatters.label", "Label rules to display. For example: myLabel:/${path}. ${path}, ${scheme}, ${authority} and ${authoritySuffix} are supported as variables.")
            },
            separator: {
              type: "string",
              description: localize("vscode.extension.contributes.resourceLabelFormatters.separator", "Separator to be used in the uri label display. '/' or '' as an example.")
            },
            stripPathStartingSeparator: {
              type: "boolean",
              description: localize("vscode.extension.contributes.resourceLabelFormatters.stripPathStartingSeparator", "Controls whether `${path}` substitutions should have starting separator characters stripped.")
            },
            tildify: {
              type: "boolean",
              description: localize("vscode.extension.contributes.resourceLabelFormatters.tildify", "Controls if the start of the uri label should be tildified when possible.")
            },
            workspaceSuffix: {
              type: "string",
              description: localize("vscode.extension.contributes.resourceLabelFormatters.formatting.workspaceSuffix", "Suffix appended to the workspace label.")
            }
          }
        }
      }
    }
  }
});
const posixPathSeparatorRegexp = /\//g;
const winPathSeparatorRegexp = /[\\\/]/g;
const labelMatchingRegexp = /\$\{(scheme|authoritySuffix|authority|path|(query)\.(.+?))\}/g;
function hasDriveLetterIgnorePlatform(path) {
  return !!(path && path[2] === ":");
}
let ResourceLabelFormattersHandler = class {
  constructor(labelService) {
    this.formattersDisposables = /* @__PURE__ */ new Map();
    resourceLabelFormattersExtPoint.setHandler((extensions, delta) => {
      for (const added of delta.added) {
        for (const untrustedFormatter of added.value) {
          const formatter = { ...untrustedFormatter };
          if (typeof formatter.formatting.label !== "string") {
            formatter.formatting.label = "${authority}${path}";
          }
          if (typeof formatter.formatting.separator !== `string`) {
            formatter.formatting.separator = sep;
          }
          if (!isProposedApiEnabled(added.description, "contribLabelFormatterWorkspaceTooltip") && formatter.formatting.workspaceTooltip) {
            formatter.formatting.workspaceTooltip = void 0;
          }
          this.formattersDisposables.set(formatter, labelService.registerFormatter(formatter));
        }
      }
      for (const removed of delta.removed) {
        for (const formatter of removed.value) {
          dispose(this.formattersDisposables.get(formatter));
        }
      }
    });
  }
};
ResourceLabelFormattersHandler = __decorateClass([
  __decorateParam(0, ILabelService)
], ResourceLabelFormattersHandler);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ResourceLabelFormattersHandler, LifecyclePhase.Restored);
const FORMATTER_CACHE_SIZE = 50;
let LabelService = class extends Disposable {
  constructor(environmentService, contextService, pathService, remoteAgentService, storageService, lifecycleService) {
    super();
    this.environmentService = environmentService;
    this.contextService = contextService;
    this.pathService = pathService;
    this.remoteAgentService = remoteAgentService;
    this._onDidChangeFormatters = this._register(new Emitter({ leakWarningThreshold: 400, leakWarningName: "LabelService._onDidChangeFormatters" }));
    this.onDidChangeFormatters = this._onDidChangeFormatters.event;
    this.os = OS;
    this.userHome = pathService.defaultUriScheme === Schemas.file ? this.pathService.userHome({ preferLocal: true }) : void 0;
    const memento = this.storedFormattersMemento = new Memento("cachedResourceLabelFormatters2", storageService);
    this.storedFormatters = memento.getMemento(StorageScope.PROFILE, StorageTarget.MACHINE);
    this.formatters = this.storedFormatters?.formatters?.slice() || [];
    this.resolveRemoteEnvironment();
  }
  async resolveRemoteEnvironment() {
    const env = await this.remoteAgentService.getEnvironment();
    this.os = env?.os ?? OS;
    this.userHome = await this.pathService.userHome();
  }
  findFormatting(resource) {
    let bestResult;
    for (const formatter of this.formatters) {
      if (formatter.scheme === resource.scheme) {
        if (!formatter.authority && (!bestResult || formatter.priority)) {
          bestResult = formatter;
          continue;
        }
        if (!formatter.authority) {
          continue;
        }
        if (match(formatter.authority, resource.authority, { ignoreCase: true }) && (!bestResult?.authority || formatter.authority.length > bestResult.authority.length || formatter.authority.length === bestResult.authority.length && formatter.priority)) {
          bestResult = formatter;
        }
      }
    }
    return bestResult ? bestResult.formatting : void 0;
  }
  getUriLabel(resource, options = {}) {
    let formatting = this.findFormatting(resource);
    if (formatting && options.separator) {
      formatting = { ...formatting, separator: options.separator };
    }
    let label = this.doGetUriLabel(resource, formatting, options);
    if (!formatting && options.separator) {
      label = this.adjustPathSeparators(label, options.separator);
    }
    if (options.appendWorkspaceSuffix && formatting?.workspaceSuffix) {
      label = this.appendWorkspaceSuffix(label, resource);
    }
    return label;
  }
  doGetUriLabel(resource, formatting, options = {}) {
    if (!formatting) {
      return getPathLabel(resource, {
        os: this.os,
        tildify: this.userHome ? { userHome: this.userHome } : void 0,
        relative: options.relative ? {
          noPrefix: options.noPrefix,
          getWorkspace: () => this.contextService.getWorkspace(),
          getWorkspaceFolder: (resource2) => this.contextService.getWorkspaceFolder(resource2)
        } : void 0
      });
    }
    if (options.relative && this.contextService) {
      let folder = this.contextService.getWorkspaceFolder(resource);
      if (!folder) {
        const workspace = this.contextService.getWorkspace();
        const firstFolder = workspace.folders.at(0);
        if (firstFolder && resource.scheme !== firstFolder.uri.scheme && resource.path.startsWith(posix.sep)) {
          folder = this.contextService.getWorkspaceFolder(firstFolder.uri.with({ path: resource.path }));
        }
      }
      if (folder) {
        const folderLabel = this.formatUri(folder.uri, formatting, options.noPrefix);
        let relativeLabel = this.formatUri(resource, formatting, options.noPrefix);
        let overlap = 0;
        while (relativeLabel[overlap] && relativeLabel[overlap] === folderLabel[overlap]) {
          overlap++;
        }
        if (!relativeLabel[overlap] || relativeLabel[overlap] === formatting.separator) {
          relativeLabel = relativeLabel.substring(1 + overlap);
        } else if (overlap === folderLabel.length && folder.uri.path === posix.sep) {
          relativeLabel = relativeLabel.substring(overlap);
        }
        const hasMultipleRoots = this.contextService.getWorkspace().folders.length > 1;
        if (hasMultipleRoots && !options.noPrefix) {
          const rootName = folder?.name ?? basenameOrAuthority(folder.uri);
          relativeLabel = relativeLabel ? `${rootName} \u2022 ${relativeLabel}` : rootName;
        }
        return relativeLabel;
      }
    }
    return this.formatUri(resource, formatting, options.noPrefix);
  }
  getUriBasenameLabel(resource) {
    const formatting = this.findFormatting(resource);
    const label = this.doGetUriLabel(resource, formatting);
    let pathLib;
    if (formatting?.separator === win32.sep) {
      pathLib = win32;
    } else if (formatting?.separator === posix.sep) {
      pathLib = posix;
    } else {
      pathLib = this.os === OperatingSystem.Windows ? win32 : posix;
    }
    return pathLib.basename(label);
  }
  getWorkspaceLabel(workspace, options) {
    if (isWorkspace(workspace)) {
      const identifier = toWorkspaceIdentifier(workspace);
      if (isSingleFolderWorkspaceIdentifier(identifier) || isWorkspaceIdentifier(identifier)) {
        return this.getWorkspaceLabel(identifier, options);
      }
      return "";
    }
    if (URI.isUri(workspace)) {
      return this.doGetSingleFolderWorkspaceLabel(workspace, options);
    }
    if (isSingleFolderWorkspaceIdentifier(workspace)) {
      return this.doGetSingleFolderWorkspaceLabel(workspace.uri, options);
    }
    if (isWorkspaceIdentifier(workspace)) {
      return this.doGetWorkspaceLabel(workspace.configPath, options);
    }
    return "";
  }
  doGetWorkspaceLabel(workspaceUri, options) {
    if (isUntitledWorkspace(workspaceUri, this.environmentService)) {
      return localize("untitledWorkspace", "Untitled (Workspace)");
    }
    if (isTemporaryWorkspace(workspaceUri)) {
      return localize("temporaryWorkspace", "Workspace");
    }
    let filename = basename(workspaceUri);
    if (filename.endsWith(WORKSPACE_EXTENSION)) {
      filename = filename.substr(0, filename.length - WORKSPACE_EXTENSION.length - 1);
    }
    let label;
    switch (options?.verbose) {
      case Verbosity.SHORT:
        label = filename;
        break;
      case Verbosity.LONG:
        label = localize("workspaceNameVerbose", "{0} (Workspace)", this.getUriLabel(joinPath(dirname(workspaceUri), filename)));
        break;
      case Verbosity.MEDIUM:
      default:
        label = localize("workspaceName", "{0} (Workspace)", filename);
        break;
    }
    if (options?.verbose === Verbosity.SHORT) {
      return label;
    }
    return this.appendWorkspaceSuffix(label, workspaceUri);
  }
  doGetSingleFolderWorkspaceLabel(folderUri, options) {
    let label;
    switch (options?.verbose) {
      case Verbosity.LONG:
        label = this.getUriLabel(folderUri);
        break;
      case Verbosity.SHORT:
      case Verbosity.MEDIUM:
      default:
        label = basename(folderUri) || posix.sep;
        break;
    }
    if (options?.verbose === Verbosity.SHORT) {
      return label;
    }
    return this.appendWorkspaceSuffix(label, folderUri);
  }
  getSeparator(scheme, authority) {
    const formatter = this.findFormatting(URI.from({ scheme, authority }));
    return formatter?.separator || posix.sep;
  }
  getHostLabel(scheme, authority) {
    const formatter = this.findFormatting(URI.from({ scheme, authority }));
    return formatter?.workspaceSuffix || authority || "";
  }
  getHostTooltip(scheme, authority) {
    const formatter = this.findFormatting(URI.from({ scheme, authority }));
    return formatter?.workspaceTooltip;
  }
  registerCachedFormatter(formatter) {
    const list = this.storedFormatters.formatters ??= [];
    let replace = list.findIndex((f) => f.scheme === formatter.scheme && f.authority === formatter.authority);
    if (replace === -1 && list.length >= FORMATTER_CACHE_SIZE) {
      replace = FORMATTER_CACHE_SIZE - 1;
    }
    if (replace === -1) {
      list.unshift(formatter);
    } else {
      for (let i = replace; i > 0; i--) {
        list[i] = list[i - 1];
      }
      list[0] = formatter;
    }
    this.storedFormattersMemento.saveMemento();
    return this.registerFormatter(formatter);
  }
  registerFormatter(formatter) {
    this.formatters.push(formatter);
    this._onDidChangeFormatters.fire({ scheme: formatter.scheme });
    return {
      dispose: () => {
        this.formatters = this.formatters.filter((f) => f !== formatter);
        this._onDidChangeFormatters.fire({ scheme: formatter.scheme });
      }
    };
  }
  formatUri(resource, formatting, forceNoTildify) {
    let label = formatting.label.replace(labelMatchingRegexp, (match2, token, qsToken, qsValue) => {
      switch (token) {
        case "scheme":
          return resource.scheme;
        case "authority":
          return resource.authority;
        case "authoritySuffix": {
          const i = resource.authority.indexOf("+");
          return i === -1 ? resource.authority : resource.authority.slice(i + 1);
        }
        case "path": {
          let pathValue = resource.path;
          if (formatting.stripPathSegments) {
            let pos = 0;
            for (let i = 0; i < formatting.stripPathSegments; i++) {
              const next = pathValue.indexOf("/", pos + 1);
              if (next === -1) {
                break;
              }
              pos = next;
            }
            pathValue = pathValue.substring(pos);
          }
          return formatting.stripPathStartingSeparator ? pathValue.slice(pathValue[0] === formatting.separator ? 1 : 0) : pathValue;
        }
        default: {
          if (qsToken === "query") {
            const { query } = resource;
            if (query && query[0] === "{" && query[query.length - 1] === "}") {
              try {
                return JSON.parse(query)[qsValue] || "";
              } catch {
              }
            }
          }
          return "";
        }
      }
    });
    if (formatting.normalizeDriveLetter && hasDriveLetterIgnorePlatform(label)) {
      label = label.charAt(1).toUpperCase() + label.substr(2);
    }
    if (formatting.tildify && !forceNoTildify) {
      if (this.userHome) {
        label = tildify(label, this.userHome.fsPath, this.os);
      }
    }
    if (formatting.authorityPrefix && resource.authority) {
      label = formatting.authorityPrefix + label;
    }
    return this.adjustPathSeparators(label, formatting.separator);
  }
  adjustPathSeparators(label, separator) {
    return label.replace(this.os === OperatingSystem.Windows ? winPathSeparatorRegexp : posixPathSeparatorRegexp, separator);
  }
  appendWorkspaceSuffix(label, uri) {
    const formatting = this.findFormatting(uri);
    const suffix = formatting && typeof formatting.workspaceSuffix === "string" ? formatting.workspaceSuffix : void 0;
    return suffix ? `${label} [${suffix}]` : label;
  }
};
LabelService = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IPathService),
  __decorateParam(3, IRemoteAgentService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, ILifecycleService)
], LabelService);
registerSingleton(ILabelService, LabelService, InstantiationType.Delayed);
export {
  LabelService
};
