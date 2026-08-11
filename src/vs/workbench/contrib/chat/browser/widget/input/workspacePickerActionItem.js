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
import * as dom from "../../../../../../base/browser/dom.js";
import { renderLabelWithIcons } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { basename } from "../../../../../../base/common/resources.js";
import { localize } from "../../../../../../nls.js";
import { IActionWidgetService } from "../../../../../../platform/actionWidget/browser/actionWidget.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { ChatInputPickerActionViewItem } from "./chatInputPickerActionItem.js";
let WorkspacePickerActionItem = class extends ChatInputPickerActionViewItem {
  constructor(action, delegate, pickerOptions, actionWidgetService, keybindingService, contextKeyService, commandService, telemetryService) {
    const actionProvider = {
      getActions: () => {
        const currentWorkspace = this.delegate.getSelectedWorkspace();
        const workspaces = this.delegate.getWorkspaces();
        const actions = workspaces.map((workspace) => ({
          ...action,
          id: `workspace.${workspace.uri.toString()}`,
          label: workspace.label,
          checked: currentWorkspace?.uri.toString() === workspace.uri.toString(),
          icon: workspace.isFolder ? { id: "folder" } : { id: "file-symlink-directory" },
          enabled: true,
          tooltip: workspace.uri.fsPath,
          run: async () => {
            this.delegate.setSelectedWorkspace(workspace);
            if (this.element) {
              this.renderLabel(this.element);
            }
          }
        }));
        actions.push({
          ...action,
          id: "workspace.openFolder",
          label: localize("openFolder", "Open Folder..."),
          checked: false,
          enabled: true,
          tooltip: localize("openFolderTooltip", "Open Folder..."),
          run: async () => {
            this.commandService.executeCommand(this.delegate.openFolderCommand);
          }
        });
        return actions;
      }
    };
    const actionBarActionProvider = {
      getActions: () => []
    };
    const workspacePickerOptions = {
      actionProvider,
      actionBarActionProvider,
      showItemKeybindings: false,
      reporter: { id: "ChatWorkspacePicker", name: "ChatWorkspacePicker", includeOptions: false }
    };
    super(action, workspacePickerOptions, pickerOptions, actionWidgetService, keybindingService, contextKeyService, telemetryService);
    this.delegate = delegate;
    this.commandService = commandService;
    this._register(this.delegate.onDidChangeSelectedWorkspace(() => {
      if (this.element) {
        this.renderLabel(this.element);
      }
    }));
    this._register(this.delegate.onDidChangeWorkspaces(() => {
      if (this.element) {
        this.renderLabel(this.element);
      }
    }));
  }
  renderLabel(element) {
    this.setAriaLabelAttributes(element);
    const currentWorkspace = this.delegate.getSelectedWorkspace();
    const labelElements = [];
    if (currentWorkspace) {
      const label = currentWorkspace.label || basename(currentWorkspace.uri);
      labelElements.push(...renderLabelWithIcons(`$(folder)`));
      labelElements.push(dom.$("span.chat-input-picker-label", void 0, label));
    } else {
      labelElements.push(...renderLabelWithIcons(`$(folder)`));
      labelElements.push(dom.$("span.chat-input-picker-label", void 0, localize("selectWorkspace", "Workspace")));
    }
    dom.reset(element, ...labelElements);
    return null;
  }
};
WorkspacePickerActionItem = __decorateClass([
  __decorateParam(3, IActionWidgetService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, ITelemetryService)
], WorkspacePickerActionItem);
export {
  WorkspacePickerActionItem
};
