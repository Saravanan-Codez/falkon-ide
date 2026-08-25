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
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { basename } from "../../../../../base/common/path.js";
import { URI } from "../../../../../base/common/uri.js";
import { Emitter } from "../../../../../base/common/event.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { FileSystemProviderCapabilities, IFileService } from "../../../../../platform/files/common/files.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { GeneralShellType, ITerminalLogService, WindowsShellType } from "../../../../../platform/terminal/common/terminal.js";
import { TerminalSuggestSettingId } from "../common/terminalSuggestConfiguration.js";
import { TerminalCompletionItemKind } from "./terminalCompletionItem.js";
import { env as processEnv } from "../../../../../base/common/process.js";
import { timeout } from "../../../../../base/common/async.js";
import { gitBashToWindowsPath, windowsToGitBashPath } from "./terminalGitBashHelpers.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { match } from "../../../../../base/common/glob.js";
import { isString } from "../../../../../base/common/types.js";
const ITerminalCompletionService = createDecorator("terminalCompletionService");
class TerminalCompletionList {
  /**
   * Creates a new completion list.
   *
   * @param items The completion items.
   * @param isIncomplete The list is not complete.
   */
  constructor(items, resourceOptions) {
    this.items = items;
    this.resourceOptions = resourceOptions;
  }
}
let TerminalCompletionService = class extends Disposable {
  constructor(_configurationService, _fileService, _labelService, _logService) {
    super();
    this._configurationService = _configurationService;
    this._fileService = _fileService;
    this._labelService = _labelService;
    this._logService = _logService;
    this._providers = /* @__PURE__ */ new Map();
    this._onDidChangeProviders = this._register(new Emitter());
    this.onDidChangeProviders = this._onDidChangeProviders.event;
    this._processEnv = processEnv;
  }
  get providers() {
    return this._providersGenerator();
  }
  *_providersGenerator() {
    for (const providerMap of this._providers.values()) {
      for (const provider of providerMap.values()) {
        yield provider;
      }
    }
  }
  /** Overrides the environment for testing purposes. */
  set processEnv(env) {
    this._processEnv = env;
  }
  registerTerminalCompletionProvider(extensionIdentifier, id, provider, ...triggerCharacters) {
    let extMap = this._providers.get(extensionIdentifier);
    if (!extMap) {
      extMap = /* @__PURE__ */ new Map();
      this._providers.set(extensionIdentifier, extMap);
    }
    provider.triggerCharacters = triggerCharacters;
    provider.id = id;
    extMap.set(id, provider);
    this._onDidChangeProviders.fire();
    return toDisposable(() => {
      const extMap2 = this._providers.get(extensionIdentifier);
      if (extMap2) {
        extMap2.delete(id);
        if (extMap2.size === 0) {
          this._providers.delete(extensionIdentifier);
        }
      }
      this._onDidChangeProviders.fire();
    });
  }
  async provideCompletions(promptValue, cursorPosition, allowFallbackCompletions, shellType, capabilities, token, triggerCharacter, skipExtensionCompletions, explicitlyInvoked) {
    this._logService.trace("TerminalCompletionService#provideCompletions");
    if (!this._providers || !this._providers.values || cursorPosition < 0) {
      return void 0;
    }
    let providers;
    if (triggerCharacter) {
      const providersToRequest = [];
      for (const provider of this.providers) {
        if (!provider.triggerCharacters) {
          continue;
        }
        for (const char of provider.triggerCharacters) {
          if (promptValue.substring(0, cursorPosition)?.endsWith(char)) {
            providersToRequest.push(provider);
            break;
          }
        }
      }
      providers = providersToRequest;
    } else {
      providers = [...this._providers.values()].flatMap((providerMap) => [...providerMap.values()]);
    }
    if (skipExtensionCompletions) {
      providers = providers.filter((p) => p.isBuiltin);
      return this._collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token, explicitlyInvoked);
    }
    providers = this._getEnabledProviders(providers);
    if (!providers.length) {
      return;
    }
    return this._collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token, explicitlyInvoked);
  }
  _getEnabledProviders(providers) {
    const providerConfig = this._configurationService.getValue(TerminalSuggestSettingId.Providers);
    return providers.filter((p) => {
      const providerId = p.id;
      return providerId && (!Object.prototype.hasOwnProperty.call(providerConfig, providerId) || providerConfig[providerId] !== false);
    });
  }
  async _collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token, explicitlyInvoked) {
    this._logService.trace("TerminalCompletionService#_collectCompletions");
    const completionPromises = providers.map(async (provider) => {
      if (provider.shellTypes && shellType && !provider.shellTypes.includes(shellType)) {
        return void 0;
      }
      const timeoutMs = explicitlyInvoked ? 3e4 : 5e3;
      let timedOut = false;
      let completions;
      try {
        completions = await Promise.race([
          provider.provideCompletions(promptValue, cursorPosition, token).then((result) => {
            this._logService.trace(`TerminalCompletionService#_collectCompletions provider ${provider.id} finished`);
            return result;
          }),
          (async () => {
            await timeout(timeoutMs);
            timedOut = true;
            return void 0;
          })()
        ]);
      } catch (e) {
        this._logService.trace(`[TerminalCompletionService] Exception from provider '${provider.id}':`, e);
        return void 0;
      }
      if (timedOut) {
        this._logService.trace(`[TerminalCompletionService] Provider '${provider.id}' timed out after ${timeoutMs}ms. promptValue='${promptValue}', cursorPosition=${cursorPosition}, explicitlyInvoked=${explicitlyInvoked}`);
        return void 0;
      }
      if (!completions) {
        return void 0;
      }
      const completionItems = Array.isArray(completions) ? completions : completions.items ?? [];
      this._logService.trace(`TerminalCompletionService#_collectCompletions amend ${completionItems.length} completion items`);
      if (shellType === GeneralShellType.PowerShell) {
        for (const completion of completionItems) {
          const start = completion.replacementRange ? completion.replacementRange[0] : 0;
          completion.isFileOverride ??= completion.kind === TerminalCompletionItemKind.Method && start === 0;
        }
      }
      if (provider.isBuiltin) {
        for (const item of completionItems) {
          item.provider ??= provider.id;
        }
      }
      if (Array.isArray(completions)) {
        return completionItems;
      }
      if (completions.resourceOptions) {
        const resourceCompletions = await this.resolveResources(completions.resourceOptions, promptValue, cursorPosition, `core:path:ext:${provider.id}`, capabilities, shellType);
        this._logService.trace(`TerminalCompletionService#_collectCompletions dedupe`);
        if (resourceCompletions) {
          const labels = new Set(completionItems.map((c) => c.label));
          for (const item of resourceCompletions) {
            if (!labels.has(item.label)) {
              completionItems.push(item);
            }
          }
        }
        this._logService.trace(`TerminalCompletionService#_collectCompletions dedupe done`);
      }
      return completionItems;
    });
    const results = await Promise.all(completionPromises);
    this._logService.trace("TerminalCompletionService#_collectCompletions done");
    return results.filter((result) => !!result).flat();
  }
  async resolveResources(resourceOptions, promptValue, cursorPosition, provider, capabilities, shellType) {
    this._logService.trace(`TerminalCompletionService#resolveResources`);
    const useWindowsStylePath = resourceOptions.pathSeparator === "\\";
    if (useWindowsStylePath) {
      promptValue = promptValue.replaceAll(/[\\/]/g, resourceOptions.pathSeparator);
    }
    const showDirectories = (resourceOptions.showDirectories || resourceOptions.showFiles) ?? false;
    const showFiles = resourceOptions.showFiles ?? false;
    const globPattern = resourceOptions.globPattern ?? void 0;
    if (!showDirectories && !showFiles) {
      return;
    }
    const resourceCompletions = [];
    const cursorPrefix = promptValue.substring(0, cursorPosition);
    const wordsBeforeCursor = cursorPrefix.split(/(?<!\\) /);
    const isCommandPosition = wordsBeforeCursor.length <= 1 && !cursorPrefix.endsWith(" ");
    let lastWord = cursorPrefix.endsWith(" ") ? "" : cursorPrefix.split(/(?<!\\) /).at(-1) ?? "";
    const matchEnvVarPrefix = lastWord.match(/^[a-zA-Z_]+=(?<rhs>.+)$/);
    if (matchEnvVarPrefix?.groups?.rhs) {
      lastWord = matchEnvVarPrefix.groups.rhs;
    }
    let lastSlashIndex;
    if (useWindowsStylePath) {
      let lastBackslashIndex = -1;
      for (let i = lastWord.length - 1; i >= 0; i--) {
        if (lastWord[i] === "\\") {
          if (i === lastWord.length - 1 || lastWord[i + 1] !== " ") {
            lastBackslashIndex = i;
            break;
          }
        }
      }
      lastSlashIndex = Math.max(lastBackslashIndex, lastWord.lastIndexOf("/"));
    } else {
      lastSlashIndex = lastWord.lastIndexOf(resourceOptions.pathSeparator);
    }
    let lastWordFolder = lastSlashIndex === -1 ? "" : lastWord.slice(0, lastSlashIndex + 1);
    if (useWindowsStylePath) {
      lastWordFolder = lastWordFolder.replaceAll("/", "\\");
    }
    const lastWordFolderHasDotPrefix = !!lastWordFolder.match(/^\.\.?[\\\/]/);
    const lastWordFolderHasTildePrefix = !!lastWordFolder.match(/^~[\\\/]?/);
    const isAbsolutePath = getIsAbsolutePath(shellType, resourceOptions.pathSeparator, lastWordFolder, useWindowsStylePath);
    const type = lastWordFolderHasTildePrefix ? "tilde" : isAbsolutePath ? "absolute" : "relative";
    const cwd = URI.revive(resourceOptions.cwd);
    let lastWordFolderResource;
    if (type === "relative" && lastWordFolder.length > 0) {
      const normalizedFolder = (useWindowsStylePath ? lastWordFolder.replaceAll("\\", "/") : lastWordFolder).replaceAll("\\ ", " ");
      const hasDotPrefix = normalizedFolder.startsWith("./");
      if (hasDotPrefix) {
        const stripped = normalizedFolder.replace(/^\.\/+/, "").replace(/\/+$/, "");
        if (stripped) {
          const cwdParts = cwd.path.replace(/\/+$/, "").split("/");
          const strippedParts = stripped.split("/");
          const tailMatches = strippedParts.length <= cwdParts.length && strippedParts.every((part, idx) => cwdParts[cwdParts.length - strippedParts.length + idx] === part);
          if (tailMatches) {
            try {
              await this._fileService.stat(cwd);
              lastWordFolderResource = cwd;
            } catch {
              return void 0;
            }
          }
        } else {
          try {
            await this._fileService.stat(cwd);
            lastWordFolderResource = cwd;
          } catch {
            return void 0;
          }
        }
      }
      if (!lastWordFolderResource) {
        const folderToResolve = URI.joinPath(cwd, normalizedFolder);
        try {
          await this._fileService.stat(folderToResolve);
          lastWordFolderResource = folderToResolve;
        } catch {
          return void 0;
        }
      }
    } else if (type === "relative") {
      lastWordFolderResource = cwd;
    }
    if (type === "relative" && !lastWordFolderResource) {
      try {
        await this._fileService.stat(cwd);
        lastWordFolderResource = cwd;
      } catch {
        return void 0;
      }
    }
    switch (type) {
      case "tilde": {
        const home = this._getHomeDir(useWindowsStylePath, capabilities);
        if (home) {
          lastWordFolderResource = URI.joinPath(createUriFromLocalPath(cwd, home), lastWordFolder.slice(1).replaceAll("\\ ", " "));
        }
        if (!lastWordFolderResource) {
          if (lastWord.match(/^~[\\\/]$/)) {
            lastWordFolderResource = useWindowsStylePath ? "Home directory" : "$HOME";
          }
        }
        break;
      }
      case "absolute": {
        if (shellType === WindowsShellType.GitBash) {
          lastWordFolderResource = createUriFromLocalPath(cwd, gitBashToWindowsPath(lastWordFolder, this._processEnv.SystemDrive));
        } else {
          lastWordFolderResource = createUriFromLocalPath(cwd, lastWordFolder.replaceAll("\\ ", " "));
        }
        break;
      }
      case "relative": {
        lastWordFolderResource ??= cwd;
        break;
      }
    }
    if (!lastWordFolderResource) {
      return void 0;
    }
    if (isString(lastWordFolderResource)) {
      resourceCompletions.push({
        label: lastWordFolder,
        provider,
        kind: TerminalCompletionItemKind.Folder,
        detail: lastWordFolderResource,
        replacementRange: [cursorPosition - lastWord.length, cursorPosition]
      });
      return resourceCompletions;
    }
    const stat = await this._fileService.resolve(lastWordFolderResource, {
      resolveMetadata: true,
      resolveSingleChildDescendants: true
    });
    if (!stat?.children) {
      return;
    }
    this._logService.trace(`TerminalCompletionService#resolveResources cwd`);
    if (showDirectories) {
      let label;
      switch (type) {
        case "tilde": {
          label = lastWordFolder;
          break;
        }
        case "absolute": {
          label = lastWordFolder;
          break;
        }
        case "relative": {
          label = ".";
          if (lastWordFolder.length > 0) {
            label = addPathRelativePrefix(lastWordFolder, resourceOptions, lastWordFolderHasDotPrefix);
          }
          break;
        }
      }
      resourceCompletions.push({
        label,
        provider,
        kind: TerminalCompletionItemKind.Folder,
        detail: getFriendlyPath(this._labelService, lastWordFolderResource, resourceOptions.pathSeparator, TerminalCompletionItemKind.Folder, shellType),
        replacementRange: [cursorPosition - lastWord.length, cursorPosition]
      });
    }
    this._logService.trace(`TerminalCompletionService#resolveResources direct children`);
    await Promise.all(stat.children.map((child) => (async () => {
      let kind;
      let detail = void 0;
      if (showDirectories && child.isDirectory) {
        if (child.isSymbolicLink) {
          kind = TerminalCompletionItemKind.SymbolicLinkFolder;
        } else {
          kind = TerminalCompletionItemKind.Folder;
        }
      } else if (showFiles && child.isFile) {
        if (isCommandPosition && !useWindowsStylePath) {
          if (!child.executable) {
            return;
          }
        }
        if (child.isSymbolicLink) {
          kind = TerminalCompletionItemKind.SymbolicLinkFile;
        } else {
          kind = TerminalCompletionItemKind.File;
        }
      }
      if (kind === void 0) {
        return;
      }
      let label = lastWordFolder;
      if (label.length > 0 && !label.endsWith(resourceOptions.pathSeparator)) {
        label += resourceOptions.pathSeparator;
      }
      label += child.name;
      if (type === "relative") {
        label = addPathRelativePrefix(label, resourceOptions, lastWordFolderHasDotPrefix);
      }
      if (child.isDirectory && !label.endsWith(resourceOptions.pathSeparator)) {
        label += resourceOptions.pathSeparator;
      }
      label = escapeTerminalCompletionLabel(label, shellType, resourceOptions.pathSeparator);
      if (child.isFile && globPattern) {
        const filePath = child.resource.fsPath;
        const ignoreCase = !this._fileService.hasCapability(child.resource, FileSystemProviderCapabilities.PathCaseSensitive);
        const matches = match(globPattern, filePath, { ignoreCase });
        if (!matches) {
          return;
        }
      }
      if (child.isSymbolicLink) {
        try {
          const realpath = await this._fileService.realpath(child.resource);
          if (realpath && !isEqual(child.resource, realpath)) {
            detail = `${getFriendlyPath(this._labelService, child.resource, resourceOptions.pathSeparator, kind, shellType)} -> ${getFriendlyPath(this._labelService, realpath, resourceOptions.pathSeparator, kind, shellType)}`;
          }
        } catch (error) {
        }
      }
      resourceCompletions.push({
        label,
        provider,
        kind,
        detail: detail ?? getFriendlyPath(this._labelService, child.resource, resourceOptions.pathSeparator, kind, shellType),
        replacementRange: [cursorPosition - lastWord.length, cursorPosition]
      });
    })()));
    this._logService.trace(`TerminalCompletionService#resolveResources CDPATH`);
    if (type === "relative" && showDirectories) {
      if (promptValue.startsWith("cd ")) {
        const config = this._configurationService.getValue(TerminalSuggestSettingId.CdPath);
        if (config === "absolute" || config === "relative") {
          const cdPath = this._getEnvVar("CDPATH", capabilities);
          if (cdPath) {
            const cdPathEntries = cdPath.split(useWindowsStylePath ? ";" : ":");
            for (const cdPathEntry of cdPathEntries) {
              try {
                const fileStat = await this._fileService.resolve(createUriFromLocalPath(cwd, cdPathEntry), { resolveSingleChildDescendants: true });
                if (fileStat?.children) {
                  for (const child of fileStat.children) {
                    if (!child.isDirectory) {
                      continue;
                    }
                    const useRelative = config === "relative";
                    const kind = TerminalCompletionItemKind.Folder;
                    const label = useRelative ? basename(child.resource.fsPath) : shellType === WindowsShellType.GitBash ? windowsToGitBashPath(child.resource.fsPath) : getFriendlyPath(this._labelService, child.resource, resourceOptions.pathSeparator, kind, shellType);
                    const detail = useRelative ? `CDPATH ${getFriendlyPath(this._labelService, child.resource, resourceOptions.pathSeparator, kind, shellType)}` : `CDPATH`;
                    resourceCompletions.push({
                      label,
                      provider,
                      kind,
                      detail,
                      replacementRange: [cursorPosition - lastWord.length, cursorPosition]
                    });
                  }
                }
              } catch {
              }
            }
          }
        }
      }
    }
    this._logService.trace(`TerminalCompletionService#resolveResources parent dir`);
    if (type === "relative" && showDirectories) {
      let label = `..${resourceOptions.pathSeparator}`;
      if (lastWordFolder.length > 0) {
        label = addPathRelativePrefix(lastWordFolder + label, resourceOptions, lastWordFolderHasDotPrefix);
      }
      const parentDir = URI.joinPath(lastWordFolderResource, ".." + resourceOptions.pathSeparator);
      resourceCompletions.push({
        label,
        provider,
        kind: TerminalCompletionItemKind.Folder,
        detail: getFriendlyPath(this._labelService, parentDir, resourceOptions.pathSeparator, TerminalCompletionItemKind.Folder, shellType),
        replacementRange: [cursorPosition - lastWord.length, cursorPosition]
      });
    }
    this._logService.trace(`TerminalCompletionService#resolveResources tilde`);
    if (type === "relative" && !lastWordFolder.match(/[\\\/]/)) {
      let homeResource;
      const home = this._getHomeDir(useWindowsStylePath, capabilities);
      if (home) {
        homeResource = createUriFromLocalPath(cwd, home);
      }
      if (!homeResource) {
        homeResource = useWindowsStylePath ? "Home directory" : "$HOME";
      }
      resourceCompletions.push({
        label: "~",
        provider,
        kind: TerminalCompletionItemKind.Folder,
        detail: isString(homeResource) ? homeResource : getFriendlyPath(this._labelService, homeResource, resourceOptions.pathSeparator, TerminalCompletionItemKind.Folder, shellType),
        replacementRange: [cursorPosition - lastWord.length, cursorPosition]
      });
    }
    this._logService.trace(`TerminalCompletionService#resolveResources done`);
    return resourceCompletions;
  }
  _getEnvVar(key, capabilities) {
    const env = capabilities.get(TerminalCapability.ShellEnvDetection)?.env?.value;
    if (env) {
      return env[key];
    }
    return this._processEnv[key];
  }
  _getHomeDir(useWindowsStylePath, capabilities) {
    return useWindowsStylePath ? this._getEnvVar("USERPROFILE", capabilities) : this._getEnvVar("HOME", capabilities);
  }
};
TerminalCompletionService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, ITerminalLogService)
], TerminalCompletionService);
function getFriendlyPath(labelService, uri, pathSeparator, kind, shellType) {
  let path = labelService.getUriLabel(uri, { noPrefix: true });
  const sep = shellType === WindowsShellType.GitBash ? "\\" : pathSeparator;
  if (kind === TerminalCompletionItemKind.Folder && !path.endsWith(sep)) {
    path += sep;
  }
  return path;
}
function addPathRelativePrefix(text, resourceOptions, lastWordFolderHasDotPrefix) {
  if (!lastWordFolderHasDotPrefix) {
    if (text.startsWith(resourceOptions.pathSeparator)) {
      return `.${text}`;
    }
    return `.${resourceOptions.pathSeparator}${text}`;
  }
  return text;
}
function escapeTerminalCompletionLabel(label, shellType, pathSeparator) {
  if (shellType === void 0 || shellType === GeneralShellType.PowerShell || shellType === WindowsShellType.CommandPrompt) {
    return label;
  }
  return label.replace(/[\[\]\(\)'"\\\`\*\?;|&<>]/g, "\\$&");
}
function getIsAbsolutePath(shellType, pathSeparator, lastWord, useWindowsStylePath) {
  if (shellType === WindowsShellType.GitBash) {
    return lastWord.startsWith(pathSeparator) || /^[a-zA-Z]:\//.test(lastWord);
  }
  return useWindowsStylePath ? /^[a-zA-Z]:[\\\/]/.test(lastWord) : lastWord.startsWith(pathSeparator);
}
function createUriFromLocalPath(cwd, absolutePath) {
  if (cwd.scheme === "file") {
    return URI.file(absolutePath);
  }
  return cwd.with({ path: absolutePath });
}
export {
  ITerminalCompletionService,
  TerminalCompletionList,
  TerminalCompletionService,
  escapeTerminalCompletionLabel
};
