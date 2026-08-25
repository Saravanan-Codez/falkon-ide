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
import { MarkdownString } from "../../../../../../../../base/common/htmlContent.js";
import { visit } from "../../../../../../../../base/common/json.js";
import { Disposable } from "../../../../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../../../../base/common/uri.js";
import { IUriIdentityService } from "../../../../../../../../platform/uriIdentity/common/uriIdentity.js";
import { localize } from "../../../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../../../../platform/files/common/files.js";
import { IWorkspaceContextService } from "../../../../../../../../platform/workspace/common/workspace.js";
import { TerminalChatAgentToolsSettingId } from "../../../../common/terminalChatAgentToolsConfiguration.js";
const npmRunPatterns = [
  // npm run <script>
  // npm run-script <script>
  /^(?<command>npm)\s+(?:run(?:-script)?)\s+(?<scriptName>[^\s&|;]+)/i,
  // npm test, npm start, npm stop, npm restart (shorthand commands)
  // See https://docs.npmjs.com/cli/v10/commands/npm-run-script
  /^(?<command>npm)\s+(?<scriptName>test|start|stop|restart)\b/i,
  // yarn <script>
  // yarn run <script>
  /^(?<command>yarn)\s+(?:run\s+)?(?<scriptName>[^\s&|;]+)/i,
  // pnpm <script>
  // pnpm run <script>
  /^(?<command>pnpm)\s+(?:run\s+)?(?<scriptName>[^\s&|;]+)/i
];
const yarnBuiltinCommands = /* @__PURE__ */ new Set([
  "add",
  "audit",
  "autoclean",
  "bin",
  "cache",
  "check",
  "config",
  "create",
  "dedupe",
  "dlx",
  "exec",
  "explain",
  "generate-lock-entry",
  "global",
  "help",
  "import",
  "info",
  "init",
  "install",
  "licenses",
  "link",
  "list",
  "login",
  "logout",
  "node",
  "outdated",
  "owner",
  "pack",
  "patch",
  "patch-commit",
  "plugin",
  "policies",
  "publish",
  "rebuild",
  "remove",
  "run",
  "search",
  "set",
  "stage",
  "tag",
  "team",
  "unlink",
  "unplug",
  "up",
  "upgrade",
  "upgrade-interactive",
  "version",
  "versions",
  "why",
  "workspace",
  "workspaces"
]);
const pnpmBuiltinCommands = /* @__PURE__ */ new Set([
  "add",
  "audit",
  "bin",
  "config",
  "dedupe",
  "deploy",
  "dlx",
  "doctor",
  "env",
  "exec",
  "fetch",
  "import",
  "init",
  "install",
  "install-test",
  "licenses",
  "link",
  "list",
  "ln",
  "ls",
  "outdated",
  "pack",
  "patch",
  "patch-commit",
  "patch-remove",
  "prune",
  "publish",
  "rb",
  "rebuild",
  "remove",
  "rm",
  "root",
  "run",
  "server",
  "setup",
  "store",
  "un",
  "uninstall",
  "unlink",
  "up",
  "update",
  "why"
]);
let NpmScriptAutoApprover = class extends Disposable {
  constructor(_configurationService, _fileService, _uriIdentityService, _workspaceContextService) {
    super();
    this._configurationService = _configurationService;
    this._fileService = _fileService;
    this._uriIdentityService = _uriIdentityService;
    this._workspaceContextService = _workspaceContextService;
  }
  /**
   * Checks if a single command is an npm/yarn/pnpm script that exists in package.json.
   * Returns auto-approve result if the command is a valid script.
   */
  async isCommandAutoApproved(command, cwd) {
    const isNpmScriptAutoApproveEnabled = this._configurationService.getValue(TerminalChatAgentToolsSettingId.AutoApproveWorkspaceNpmScripts) === true;
    if (!isNpmScriptAutoApproveEnabled) {
      return { isAutoApproved: false };
    }
    const scriptName = this._extractScriptName(command);
    if (!scriptName) {
      return { isAutoApproved: false };
    }
    const packageJsonScripts = await this._getPackageJsonScripts(cwd);
    if (!packageJsonScripts) {
      return { isAutoApproved: false };
    }
    if (!packageJsonScripts.scripts.has(scriptName)) {
      return { isAutoApproved: false };
    }
    return {
      isAutoApproved: true,
      scriptName,
      autoApproveInfo: new MarkdownString(
        localize("autoApprove.npmScript", "Auto approved as {0} is defined in package.json", `\`${scriptName}\``)
      )
    };
  }
  /**
   * Extracts script name from an npm/yarn/pnpm run command.
   */
  _extractScriptName(command) {
    const trimmedCommand = command.trim();
    for (const pattern of npmRunPatterns) {
      const match = trimmedCommand.match(pattern);
      if (match?.groups?.scriptName) {
        const { command: pkgManager, scriptName } = match.groups;
        if (pkgManager.toLowerCase() === "yarn" && yarnBuiltinCommands.has(scriptName.toLowerCase())) {
          continue;
        }
        if (pkgManager.toLowerCase() === "pnpm" && pnpmBuiltinCommands.has(scriptName.toLowerCase())) {
          continue;
        }
        return scriptName;
      }
    }
    return void 0;
  }
  /**
   * Checks if a URI is within any workspace folder.
   */
  _isWithinWorkspace(uri) {
    const workspaceFolders = this._workspaceContextService.getWorkspace().folders;
    return workspaceFolders.some((folder) => this._uriIdentityService.extUri.isEqualOrParent(uri, folder.uri));
  }
  /**
   * Finds and parses package.json to get the scripts section.
   * Only looks within the workspace for security.
   */
  async _getPackageJsonScripts(cwd) {
    if (!cwd || !this._isWithinWorkspace(cwd)) {
      return void 0;
    }
    const packageJsonUri = URI.joinPath(cwd, "package.json");
    const scripts = await this._readPackageJsonScripts(packageJsonUri);
    if (scripts) {
      return { uri: packageJsonUri, scripts };
    }
    return void 0;
  }
  /**
   * Reads and parses the scripts section from a package.json file.
   */
  async _readPackageJsonScripts(packageJsonUri) {
    try {
      const exists = await this._fileService.exists(packageJsonUri);
      if (!exists) {
        return void 0;
      }
      const content = await this._fileService.readFile(packageJsonUri);
      const text = content.value.toString();
      return this._parsePackageJsonScripts(text);
    } catch {
      return void 0;
    }
  }
  /**
   * Parses the scripts section from package.json content using jsonc-parser.
   */
  _parsePackageJsonScripts(content) {
    const scripts = /* @__PURE__ */ new Set();
    let inScripts = false;
    let level = 0;
    const visitor = {
      onError() {
      },
      onObjectBegin() {
        level++;
      },
      onObjectEnd() {
        if (inScripts && level === 2) {
          inScripts = false;
        }
        level--;
      },
      onObjectProperty(property) {
        if (level === 1 && property === "scripts") {
          inScripts = true;
        } else if (inScripts && level === 2) {
          scripts.add(property);
        }
      }
    };
    visit(content, visitor);
    return scripts.size > 0 ? scripts : void 0;
  }
};
NpmScriptAutoApprover = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, IWorkspaceContextService)
], NpmScriptAutoApprover);
export {
  NpmScriptAutoApprover
};
