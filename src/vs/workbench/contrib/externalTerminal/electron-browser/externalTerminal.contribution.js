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
import * as paths from "../../../../base/common/path.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { Schemas } from "../../../../base/common/network.js";
import { Extensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IExternalTerminalService } from "../../../../platform/externalTerminal/electron-browser/externalTerminalService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { TerminalContextKeys } from "../../terminal/common/terminalContextKey.js";
import { IRemoteAuthorityResolverService } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IsSessionsWindowContext } from "../../../common/contextkeys.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
const OPEN_NATIVE_CONSOLE_COMMAND_ID = "workbench.action.terminal.openNativeConsole";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: OPEN_NATIVE_CONSOLE_COMMAND_ID,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC,
  when: ContextKeyExpr.and(TerminalContextKeys.notFocus, IsSessionsWindowContext.negate()),
  weight: KeybindingWeight.WorkbenchContrib,
  handler: async (accessor) => {
    const historyService = accessor.get(IHistoryService);
    const terminalService = accessor.get(IExternalTerminalService);
    const configurationService = accessor.get(IConfigurationService);
    const remoteAuthorityResolverService = accessor.get(IRemoteAuthorityResolverService);
    const workspaceContextService = accessor.get(IWorkspaceContextService);
    const quickInputService = accessor.get(IQuickInputService);
    const labelService = accessor.get(ILabelService);
    const config = configurationService.getValue("terminal.external");
    const folders = workspaceContextService.getWorkspace().folders;
    let root;
    if (folders.length > 1) {
      const folderPicks = folders.map((folder) => ({
        label: folder.name,
        description: labelService.getUriLabel(folder.uri, { relative: true })
      }));
      const pick = await quickInputService.pick(folderPicks, {
        placeHolder: nls.localize("selectWorkspace", "Select workspace folder")
      });
      if (!pick) {
        return;
      }
      root = folders[folderPicks.indexOf(pick)].uri;
    } else {
      root = historyService.getLastActiveWorkspaceRoot();
    }
    if (root?.scheme === Schemas.file) {
      terminalService.openTerminal(config, root.fsPath);
      return;
    }
    try {
      if (root?.scheme === Schemas.vscodeRemote) {
        const canonicalUri = await remoteAuthorityResolverService.getCanonicalURI(root);
        if (canonicalUri.scheme === Schemas.file) {
          terminalService.openTerminal(config, canonicalUri.fsPath);
          return;
        }
      }
    } catch {
    }
    const activeFile = historyService.getLastActiveFile(Schemas.file);
    if (activeFile?.scheme === Schemas.file) {
      terminalService.openTerminal(config, paths.dirname(activeFile.fsPath));
      return;
    }
    try {
      if (activeFile?.scheme === Schemas.vscodeRemote) {
        const canonicalUri = await remoteAuthorityResolverService.getCanonicalURI(activeFile);
        if (canonicalUri.scheme === Schemas.file) {
          terminalService.openTerminal(config, canonicalUri.fsPath);
          return;
        }
      }
    } catch {
    }
    terminalService.openTerminal(config, void 0);
  }
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: OPEN_NATIVE_CONSOLE_COMMAND_ID,
    title: nls.localize2("globalConsoleAction", "Open New External Terminal")
  }
});
let ExternalTerminalContribution = class {
  constructor(_externalTerminalService) {
    this._externalTerminalService = _externalTerminalService;
    this._updateConfiguration();
  }
  async _updateConfiguration() {
    const terminals = await this._externalTerminalService.getDefaultTerminalForPlatforms();
    const configurationRegistry = Registry.as(Extensions.Configuration);
    const terminalKindProperties = {
      type: "string",
      enum: [
        "integrated",
        "external",
        "both"
      ],
      enumDescriptions: [
        nls.localize("terminal.kind.integrated", "Show the integrated terminal action."),
        nls.localize("terminal.kind.external", "Show the external terminal action."),
        nls.localize("terminal.kind.both", "Show both integrated and external terminal actions.")
      ],
      default: "integrated"
    };
    configurationRegistry.registerConfiguration({
      id: "externalTerminal",
      order: 100,
      title: nls.localize("terminalConfigurationTitle", "External Terminal"),
      type: "object",
      properties: {
        "terminal.explorerKind": {
          ...terminalKindProperties,
          description: nls.localize("explorer.openInTerminalKind", "When opening a file from the Explorer in a terminal, determines what kind of terminal will be launched")
        },
        "terminal.sourceControlRepositoriesKind": {
          ...terminalKindProperties,
          description: nls.localize("sourceControlRepositories.openInTerminalKind", "When opening a repository from the Source Control Repositories view in a terminal, determines what kind of terminal will be launched")
        },
        "terminal.external.windowsExec": {
          type: "string",
          description: nls.localize("terminal.external.windowsExec", "Customizes which terminal to run on Windows."),
          default: terminals.windows,
          scope: ConfigurationScope.APPLICATION
        },
        "terminal.external.osxExec": {
          type: "string",
          description: nls.localize("terminal.external.osxExec", "Customizes which terminal application to run on macOS."),
          default: terminals.osx,
          scope: ConfigurationScope.APPLICATION
        },
        "terminal.external.linuxExec": {
          type: "string",
          description: nls.localize("terminal.external.linuxExec", "Customizes which terminal to run on Linux."),
          default: terminals.linux,
          scope: ConfigurationScope.APPLICATION
        }
      }
    });
  }
};
ExternalTerminalContribution = __decorateClass([
  __decorateParam(0, IExternalTerminalService)
], ExternalTerminalContribution);
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(ExternalTerminalContribution, LifecyclePhase.Restored);
export {
  ExternalTerminalContribution
};
