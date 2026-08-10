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
import { getDefaultHoverDelegate } from "../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { basename } from "../../../../../../base/common/resources.js";
import { localize } from "../../../../../../nls.js";
import { IActionWidgetService } from "../../../../../../platform/actionWidget/browser/actionWidget.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { ISCMService } from "../../../../scm/common/scm.js";
import { ChatInputPickerActionViewItem } from "../../widget/input/chatInputPickerActionItem.js";
import { IAgentHostNewSessionFolderService } from "./agentHostNewSessionFolderService.js";
let AgentHostFolderPickerActionItem = class extends ChatInputPickerActionViewItem {
  constructor(action, _widget, pickerOptions, actionWidgetService, keybindingService, contextKeyService, telemetryService, _workspaceContextService, _newSessionFolderService, _scmService, _hoverService) {
    const actionProvider = {
      getActions: () => {
        const selected = this._selectedFolder();
        return this._workspaceContextService.getWorkspace().folders.map((folder) => ({
          ...action,
          id: `agentHostFolder.${folder.uri.toString()}`,
          label: folder.name,
          checked: selected?.toString() === folder.uri.toString(),
          icon: { id: "folder" },
          enabled: true,
          tooltip: folder.uri.fsPath,
          run: async () => {
            const sessionResource = this._sessionResource();
            if (sessionResource) {
              this._newSessionFolderService.setFolder(sessionResource, folder.uri);
            }
            if (this.element) {
              this.renderLabel(this.element);
            }
          }
        }));
      }
    };
    const actionBarActionProvider = {
      getActions: () => []
    };
    const folderPickerOptions = {
      actionProvider,
      actionBarActionProvider,
      showItemKeybindings: false,
      reporter: { id: "AgentHostFolderPicker", name: "AgentHostFolderPicker", includeOptions: false }
    };
    super(action, folderPickerOptions, pickerOptions, actionWidgetService, keybindingService, contextKeyService, telemetryService);
    this._widget = _widget;
    this._workspaceContextService = _workspaceContextService;
    this._newSessionFolderService = _newSessionFolderService;
    this._scmService = _scmService;
    this._hoverService = _hoverService;
    this._hoverSetup = false;
    this._register(this._newSessionFolderService.onDidChangeFolder(() => {
      if (this.element) {
        this.renderLabel(this.element);
      }
    }));
    this._register(this._workspaceContextService.onDidChangeWorkspaceFolders(() => {
      if (this.element) {
        this.renderLabel(this.element);
      }
    }));
    this._register(this._widget.onDidChangeViewModel(() => {
      if (this.element) {
        this.renderLabel(this.element);
      }
    }));
  }
  _sessionResource() {
    return this._widget.viewModel?.sessionResource;
  }
  _selectedFolder() {
    const folders = this._workspaceContextService.getWorkspace().folders;
    const sessionResource = this._sessionResource();
    const stored = sessionResource ? this._newSessionFolderService.getFolder(sessionResource) : void 0;
    if (stored) {
      if (folders.some((folder) => folder.uri.toString() === stored.toString())) {
        return stored;
      }
      this._newSessionFolderService.clear(sessionResource);
    }
    return this._newSessionFolderService.getDefaultFolder() ?? folders[0]?.uri;
  }
  renderLabel(element) {
    this.setAriaLabelAttributes(element);
    const selected = this._selectedFolder();
    const folder = selected && this._workspaceContextService.getWorkspace().folders.find((f) => f.uri.toString() === selected.toString());
    const label = folder ? folder.name : selected ? basename(selected) : localize("agentHost.selectFolder", "Folder");
    dom.reset(
      element,
      ...renderLabelWithIcons(`$(folder)`),
      dom.$("span.chat-input-picker-label", void 0, label)
    );
    return null;
  }
  render(container) {
    super.render(container);
    if (this.element && !this._hoverSetup) {
      this._hoverSetup = true;
      this._register(this._hoverService.setupManagedHover(
        getDefaultHoverDelegate("element"),
        this.element,
        () => this._buildHoverContent()
      ));
    }
  }
  /**
   * Builds the hover content for the folder chip: the full folder path and,
   * when the folder maps to a git repository, the current branch name.
   * Returns `undefined` when no folder is selected so no hover is shown.
   */
  _buildHoverContent() {
    const selected = this._selectedFolder();
    if (!selected) {
      return void 0;
    }
    const md = new MarkdownString("", { supportThemeIcons: true });
    const fallbackLines = [];
    md.appendMarkdown(`$(${Codicon.folder.id}) `);
    md.appendText(selected.fsPath);
    fallbackLines.push(selected.fsPath);
    const branch = this._branchName(selected);
    if (branch) {
      md.appendMarkdown("\n\n$(git-branch) ");
      md.appendText(branch);
      fallbackLines.push(branch);
    }
    return { markdown: md, markdownNotSupportedFallback: fallbackLines.join("\n") };
  }
  /**
   * Resolves the current git branch name for the given folder via the SCM
   * service, or `undefined` when the folder has no associated repository or
   * branch information.
   */
  _branchName(folderUri) {
    const repository = this._scmService.getRepository(folderUri);
    const historyProvider = repository?.provider.historyProvider.get();
    return historyProvider?.historyItemRef.get()?.name.trim() || void 0;
  }
};
AgentHostFolderPickerActionItem = __decorateClass([
  __decorateParam(3, IActionWidgetService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IWorkspaceContextService),
  __decorateParam(8, IAgentHostNewSessionFolderService),
  __decorateParam(9, ISCMService),
  __decorateParam(10, IHoverService)
], AgentHostFolderPickerActionItem);
export {
  AgentHostFolderPickerActionItem
};
