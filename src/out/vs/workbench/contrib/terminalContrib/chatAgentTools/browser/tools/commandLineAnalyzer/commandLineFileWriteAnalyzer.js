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
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { win32, posix } from "../../../../../../../base/common/path.js";
import { extUri, normalizePath } from "../../../../../../../base/common/resources.js";
import { localize } from "../../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { IWorkspaceContextService } from "../../../../../../../platform/workspace/common/workspace.js";
import { containsCmdDelayedExpansion } from "../../../../../../../platform/terminal/common/autoApprove/cmdDelayedExpansion.js";
import { TerminalChatAgentToolsSettingId } from "../../../common/terminalChatAgentToolsConfiguration.js";
import { TreeSitterCommandParserLanguage } from "../../treeSitterCommandParser.js";
import { OperatingSystem } from "../../../../../../../base/common/platform.js";
import { isString } from "../../../../../../../base/common/types.js";
import { ILabelService } from "../../../../../../../platform/label/common/label.js";
const nullDevice = /* @__PURE__ */ Symbol("null device");
let CommandLineFileWriteAnalyzer = class extends Disposable {
  constructor(_treeSitterCommandParser, _log, _configurationService, _labelService, _workspaceContextService) {
    super();
    this._treeSitterCommandParser = _treeSitterCommandParser;
    this._log = _log;
    this._configurationService = _configurationService;
    this._labelService = _labelService;
    this._workspaceContextService = _workspaceContextService;
  }
  async analyze(options) {
    let fileWrites;
    try {
      fileWrites = await this._getFileWrites(options);
    } catch (e) {
      console.error(e);
      this._log("Failed to get file writes via grammar", options.treeSitterLanguage);
      return {
        isAutoApproveAllowed: false
      };
    }
    return this._getResult(options, fileWrites);
  }
  async _getFileWrites(options) {
    let fileWrites = [];
    const capturedFileWrites = (await this._treeSitterCommandParser.getFileWrites(options.treeSitterLanguage, options.commandLine)).map(this._mapNullDevice.bind(this, options));
    const commandFileWrites = (await this._treeSitterCommandParser.getCommandFileWrites(options.treeSitterLanguage, options.commandLine)).map(this._mapNullDevice.bind(this, options));
    const allCapturedFileWrites = [...capturedFileWrites, ...commandFileWrites];
    if (allCapturedFileWrites.length) {
      const cwd = options.cwd;
      if (cwd) {
        this._log("Detected cwd", cwd.toString());
        fileWrites = allCapturedFileWrites.map((e) => {
          if (e === nullDevice) {
            return e;
          }
          if (/^['"].*['"]$/.test(e)) {
            e = this._stripSurroundingQuotes(e);
          }
          const isAbsolute = options.os === OperatingSystem.Windows ? win32.isAbsolute(e) : posix.isAbsolute(e);
          if (isAbsolute) {
            return cwd.with({ path: e });
          }
          return URI.joinPath(cwd, e);
        });
      } else {
        this._log("Cwd could not be detected");
        fileWrites = allCapturedFileWrites;
      }
    }
    this._log("File writes detected", fileWrites.map((e) => e.toString()));
    return fileWrites;
  }
  _stripSurroundingQuotes(text) {
    let result = text;
    while (result.startsWith('"') && result.endsWith('"') || result.startsWith("'") && result.endsWith("'")) {
      result = result.slice(1, -1);
    }
    return result;
  }
  _mapNullDevice(options, rawFileWrite) {
    if (options.treeSitterLanguage === TreeSitterCommandParserLanguage.PowerShell) {
      return rawFileWrite === "$null" ? nullDevice : rawFileWrite;
    }
    return rawFileWrite === "/dev/null" ? nullDevice : rawFileWrite;
  }
  _getResult(options, fileWrites) {
    let isAutoApproveAllowed = true;
    if (fileWrites.length > 0) {
      const blockDetectedFileWrites = this._configurationService.getValue(TerminalChatAgentToolsSettingId.BlockDetectedFileWrites);
      switch (blockDetectedFileWrites) {
        case "all": {
          isAutoApproveAllowed = false;
          this._log('File writes blocked due to "all" setting');
          break;
        }
        case "outsideWorkspace": {
          const workspaceFolders = this._workspaceContextService.getWorkspace().folders;
          if (workspaceFolders.length > 0) {
            for (const fileWrite of fileWrites) {
              if (fileWrite === nullDevice) {
                this._log("File write to null device allowed", URI.isUri(fileWrite) ? fileWrite.toString() : fileWrite);
                continue;
              }
              if (isString(fileWrite)) {
                const isAbsolute = options.os === OperatingSystem.Windows ? win32.isAbsolute(fileWrite) : posix.isAbsolute(fileWrite);
                if (!isAbsolute) {
                  isAutoApproveAllowed = false;
                  this._log("File write blocked due to unknown terminal cwd", fileWrite);
                  break;
                }
              }
              const fileUri = normalizePath(URI.isUri(fileWrite) ? fileWrite : URI.file(fileWrite));
              if (fileUri.fsPath.match(/[$\(\){}`~%]/) || containsCmdDelayedExpansion(fileUri.fsPath)) {
                isAutoApproveAllowed = false;
                this._log("File write blocked due to likely containing a variable, sub-command, or tilde/environment-variable expansion", fileUri.toString());
                break;
              }
              const isInsideWorkspace = workspaceFolders.some(
                (folder) => folder.uri.scheme === fileUri.scheme && extUri.isEqualOrParent(fileUri, folder.uri)
              );
              if (!isInsideWorkspace) {
                if (options.hasSessionAutoApproval && this._isInTempDirectory(fileUri.path, options.os)) {
                  continue;
                }
                isAutoApproveAllowed = false;
                this._log("File write blocked outside workspace", fileUri.toString());
                break;
              }
            }
          } else {
            const hasOnlyNullDevices = fileWrites.every((fw) => fw === nullDevice);
            if (!hasOnlyNullDevices) {
              isAutoApproveAllowed = false;
              this._log("File writes blocked - no workspace folders");
            }
          }
          break;
        }
        case "never":
        default: {
          break;
        }
      }
    }
    const disclaimers = [];
    if (fileWrites.length > 0) {
      const fileWritesList = fileWrites.map((fw) => `\`${URI.isUri(fw) ? this._labelService.getUriLabel(fw) : fw === nullDevice ? "/dev/null" : fw.toString()}\``).join(", ");
      if (!isAutoApproveAllowed) {
        disclaimers.push(localize("runInTerminal.fileWriteBlockedDisclaimer", "File write operations detected that cannot be auto approved: {0}", fileWritesList));
      } else {
        disclaimers.push(localize("runInTerminal.fileWriteDisclaimer", "File write operations detected: {0}", fileWritesList));
      }
    }
    return {
      isAutoApproveAllowed,
      disclaimers
    };
  }
  /**
   * Returns true if the given URI path points inside an OS temporary directory.
   * On posix systems this matches `/tmp/`. On Windows this matches any `temp`
   * or `tmp` directory segment (case-insensitive), which covers the canonical
   * user temp (`...\AppData\Local\Temp\`), system temp (`C:\Windows\Temp\`),
   * and common dev conventions like `C:\Temp\` and `C:\tmp\`.
   */
  _isInTempDirectory(uriPath, os) {
    if (os === OperatingSystem.Windows) {
      return /[\\/]te?mp[\\/].+/i.test(uriPath);
    }
    return uriPath.startsWith("/tmp/");
  }
};
CommandLineFileWriteAnalyzer = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, IWorkspaceContextService)
], CommandLineFileWriteAnalyzer);
export {
  CommandLineFileWriteAnalyzer
};
