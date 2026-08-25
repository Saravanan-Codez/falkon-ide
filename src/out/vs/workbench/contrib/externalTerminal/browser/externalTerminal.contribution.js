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
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { URI } from "../../../../base/common/uri.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { ITerminalGroupService, ITerminalService as IIntegratedTerminalService } from "../../terminal/browser/terminal.js";
import { ResourceContextKey } from "../../../common/contextkeys.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { getMultiSelectedResources, IExplorerService } from "../../files/browser/files.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { Schemas } from "../../../../base/common/network.js";
import { distinct } from "../../../../base/common/arrays.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isWindows } from "../../../../base/common/platform.js";
import { dirname, basename } from "../../../../base/common/path.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IExternalTerminalService } from "../../../../platform/externalTerminal/common/externalTerminal.js";
import { TerminalLocation } from "../../../../platform/terminal/common/terminal.js";
import { IListService } from "../../../../platform/list/browser/listService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
const OPEN_IN_TERMINAL_COMMAND_ID = "openInTerminal";
const OPEN_IN_INTEGRATED_TERMINAL_COMMAND_ID = "openInIntegratedTerminal";
function registerOpenTerminalCommand(id, explorerKind) {
  CommandsRegistry.registerCommand({
    id,
    handler: async (accessor, resource) => {
      const configurationService = accessor.get(IConfigurationService);
      const fileService = accessor.get(IFileService);
      const integratedTerminalService = accessor.get(IIntegratedTerminalService);
      const remoteAgentService = accessor.get(IRemoteAgentService);
      const terminalGroupService = accessor.get(ITerminalGroupService);
      let externalTerminalService = void 0;
      try {
        externalTerminalService = accessor.get(IExternalTerminalService);
      } catch {
      }
      const resources = getMultiSelectedResources(resource, accessor.get(IListService), accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IExplorerService));
      return fileService.resolveAll(resources.map((r) => ({ resource: r }))).then(async (stats) => {
        const config = configurationService.getValue();
        const useIntegratedTerminal = remoteAgentService.getConnection() || explorerKind === "integrated";
        const targets = distinct(stats.filter((data) => data.success));
        if (useIntegratedTerminal) {
          const opened = {};
          const cwds = targets.map(({ stat }) => {
            const resource2 = stat.resource;
            if (stat.isDirectory) {
              return resource2;
            }
            return URI.from({
              scheme: resource2.scheme,
              authority: resource2.authority,
              fragment: resource2.fragment,
              query: resource2.query,
              path: dirname(resource2.path)
            });
          });
          for (const cwd of cwds) {
            if (opened[cwd.path]) {
              return;
            }
            opened[cwd.path] = true;
            const instance = await integratedTerminalService.createTerminal({ config: { cwd } });
            if (instance && instance.target !== TerminalLocation.Editor && (resources.length === 1 || !resource || cwd.path === resource.path || cwd.path === dirname(resource.path))) {
              integratedTerminalService.setActiveInstance(instance);
              terminalGroupService.showPanel(true);
            }
          }
        } else if (externalTerminalService) {
          distinct(targets.map(({ stat }) => stat.isDirectory ? stat.resource.fsPath : dirname(stat.resource.fsPath))).forEach((cwd) => {
            externalTerminalService.openTerminal(config.terminal.external, cwd);
          });
        }
      });
    }
  });
}
registerOpenTerminalCommand(OPEN_IN_TERMINAL_COMMAND_ID, "external");
registerOpenTerminalCommand(OPEN_IN_INTEGRATED_TERMINAL_COMMAND_ID, "integrated");
let ExternalTerminalContribution = class extends Disposable {
  constructor(_configurationService) {
    super();
    this._configurationService = _configurationService;
    const shouldShowIntegratedOnLocal = ContextKeyExpr.and(
      ResourceContextKey.Scheme.isEqualTo(Schemas.file),
      ContextKeyExpr.or(ContextKeyExpr.equals("config.terminal.explorerKind", "integrated"), ContextKeyExpr.equals("config.terminal.explorerKind", "both"))
    );
    const shouldShowExternalKindOnLocal = ContextKeyExpr.and(
      ResourceContextKey.Scheme.isEqualTo(Schemas.file),
      ContextKeyExpr.or(ContextKeyExpr.equals("config.terminal.explorerKind", "external"), ContextKeyExpr.equals("config.terminal.explorerKind", "both"))
    );
    this._openInIntegratedTerminalMenuItem = {
      group: "navigation",
      order: 30,
      command: {
        id: OPEN_IN_INTEGRATED_TERMINAL_COMMAND_ID,
        title: nls.localize("scopedConsoleAction.Integrated", "Open in Integrated Terminal")
      },
      when: ContextKeyExpr.or(shouldShowIntegratedOnLocal, ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeRemote))
    };
    this._openInTerminalMenuItem = {
      group: "navigation",
      order: 31,
      command: {
        id: OPEN_IN_TERMINAL_COMMAND_ID,
        title: nls.localize("scopedConsoleAction.external", "Open in External Terminal")
      },
      when: shouldShowExternalKindOnLocal
    };
    MenuRegistry.appendMenuItem(MenuId.ExplorerContext, this._openInTerminalMenuItem);
    MenuRegistry.appendMenuItem(MenuId.ExplorerContext, this._openInIntegratedTerminalMenuItem);
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("terminal.explorerKind") || e.affectsConfiguration("terminal.external")) {
        this._refreshOpenInTerminalMenuItemTitle();
      }
    }));
    this._refreshOpenInTerminalMenuItemTitle();
  }
  isWindows() {
    const config = this._configurationService.getValue().terminal;
    if (isWindows && config.external?.windowsExec) {
      const file = basename(config.external.windowsExec);
      if (file === "wt" || file === "wt.exe") {
        return true;
      }
    }
    return false;
  }
  _refreshOpenInTerminalMenuItemTitle() {
    if (this.isWindows()) {
      this._openInTerminalMenuItem.command.title = nls.localize("scopedConsoleAction.wt", "Open in Windows Terminal");
    }
  }
};
ExternalTerminalContribution = __decorateClass([
  __decorateParam(0, IConfigurationService)
], ExternalTerminalContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ExternalTerminalContribution, LifecyclePhase.Restored);
export {
  ExternalTerminalContribution
};
