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
import * as dom from "../../../../base/browser/dom.js";
import { DropdownWithPrimaryActionViewItem } from "../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { ITerminalConfigurationService, ITerminalEditorService, ITerminalService, terminalEditorId } from "./terminal.js";
import { getTerminalActionBarArgs } from "./terminalMenus.js";
import { ITerminalProfileResolverService, ITerminalProfileService, TerminalCommandId } from "../common/terminal.js";
import { openContextMenu } from "./terminalContextMenu.js";
import { ACTIVE_GROUP } from "../../../services/editor/common/editorService.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { TerminalLocation } from "../../../../platform/terminal/common/terminal.js";
let TerminalEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, _terminalEditorService, _terminalProfileResolverService, _terminalService, _terminalConfigurationService, contextKeyService, menuService, _instantiationService, _contextMenuService, _terminalProfileService, _workbenchLayoutService) {
    super(terminalEditorId, group, telemetryService, themeService, storageService);
    this._terminalEditorService = _terminalEditorService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._terminalService = _terminalService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._instantiationService = _instantiationService;
    this._contextMenuService = _contextMenuService;
    this._terminalProfileService = _terminalProfileService;
    this._workbenchLayoutService = _workbenchLayoutService;
    this._editorInput = void 0;
    this._cancelContextMenu = false;
    this._newDropdown = this._register(new MutableDisposable());
    this._sessionDisposables = this._register(new DisposableStore());
    this._disposableStore = this._register(new DisposableStore());
    this._dropdownMenu = this._register(menuService.createMenu(MenuId.TerminalNewDropdownContext, contextKeyService));
    this._instanceMenu = this._register(menuService.createMenu(MenuId.TerminalInstanceContext, contextKeyService));
    this._register(this._terminalProfileService.onDidChangeAvailableProfiles((profiles) => this._updateTabActionBar(profiles)));
  }
  async setInput(newInput, options, context, token) {
    this._editorInput?.terminalInstance?.detachFromElement();
    this._editorInput = newInput;
    await super.setInput(newInput, options, context, token);
    this._editorInput.terminalInstance?.attachToElement(this._overflowGuardElement);
    if (this._lastDimension) {
      this.layout(this._lastDimension);
    }
    this._editorInput.terminalInstance?.setVisible(this.isVisible() && this._workbenchLayoutService.isVisible(Parts.EDITOR_PART, this.window));
    if (this._editorInput.terminalInstance) {
      this._sessionDisposables.add(this._editorInput.terminalInstance.onDidFocus(() => this._setActiveInstance()));
      this._editorInput.setCopyLaunchConfig(this._editorInput.terminalInstance.shellLaunchConfig);
    }
  }
  clearInput() {
    super.clearInput();
    this._sessionDisposables.clear();
    if (this._overflowGuardElement && this._editorInput?.terminalInstance?.domElement.parentElement === this._overflowGuardElement) {
      this._editorInput.terminalInstance?.detachFromElement();
    }
    this._editorInput = void 0;
  }
  _setActiveInstance() {
    if (!this._editorInput?.terminalInstance) {
      return;
    }
    this._terminalEditorService.setActiveInstance(this._editorInput.terminalInstance);
  }
  focus() {
    super.focus();
    this._editorInput?.terminalInstance?.focus(true);
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  createEditor(parent) {
    this._editorInstanceElement = parent;
    this._overflowGuardElement = dom.$(".terminal-overflow-guard.terminal-editor");
    this._editorInstanceElement.appendChild(this._overflowGuardElement);
    this._registerListeners();
  }
  _registerListeners() {
    if (!this._editorInstanceElement) {
      return;
    }
    this._register(dom.addDisposableListener(this._editorInstanceElement, "mousedown", async (event) => {
      const terminal = this._terminalEditorService.activeInstance;
      if (this._terminalEditorService.instances.length > 0 && terminal) {
        const result = await terminal.handleMouseEvent(event, this._instanceMenu);
        if (typeof result === "object" && result.cancelContextMenu) {
          this._cancelContextMenu = true;
        }
      }
    }));
    this._register(dom.addDisposableListener(this._editorInstanceElement, "contextmenu", (event) => {
      const rightClickBehavior = this._terminalConfigurationService.config.rightClickBehavior;
      if (rightClickBehavior === "nothing" && !event.shiftKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this._cancelContextMenu = false;
        return;
      } else if (!this._cancelContextMenu && rightClickBehavior !== "copyPaste" && rightClickBehavior !== "paste") {
        if (!this._cancelContextMenu) {
          openContextMenu(this.window, event, this._editorInput?.terminalInstance, this._instanceMenu, this._contextMenuService);
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        this._cancelContextMenu = false;
      }
    }));
  }
  _updateTabActionBar(profiles) {
    this._disposableStore.clear();
    const actions = getTerminalActionBarArgs(TerminalLocation.Editor, profiles, this._getDefaultProfileName(), this._terminalProfileService.contributedProfiles, this._terminalService, this._dropdownMenu, this._disposableStore);
    this._newDropdown.value?.update(actions.dropdownAction, actions.dropdownMenuActions);
  }
  layout(dimension) {
    const instance = this._editorInput?.terminalInstance;
    if (instance) {
      instance.attachToElement(this._overflowGuardElement);
      instance.layout(dimension);
    }
    this._lastDimension = dimension;
  }
  setVisible(visible) {
    super.setVisible(visible);
    this._editorInput?.terminalInstance?.setVisible(visible && this._workbenchLayoutService.isVisible(Parts.EDITOR_PART, this.window));
  }
  getActionViewItem(action, options) {
    switch (action.id) {
      case TerminalCommandId.CreateTerminalEditorSameGroup: {
        if (action instanceof MenuItemAction) {
          const location = { viewColumn: ACTIVE_GROUP };
          this._disposableStore.clear();
          const actions = getTerminalActionBarArgs(location, this._terminalProfileService.availableProfiles, this._getDefaultProfileName(), this._terminalProfileService.contributedProfiles, this._terminalService, this._dropdownMenu, this._disposableStore);
          this._newDropdown.value = this._instantiationService.createInstance(DropdownWithPrimaryActionViewItem, action, actions.dropdownAction, actions.dropdownMenuActions, actions.className, { hoverDelegate: options.hoverDelegate });
          this._newDropdown.value?.update(actions.dropdownAction, actions.dropdownMenuActions);
          return this._newDropdown.value;
        }
      }
    }
    return super.getActionViewItem(action, options);
  }
  _getDefaultProfileName() {
    let defaultProfileName;
    try {
      defaultProfileName = this._terminalProfileService.getDefaultProfileName();
    } catch (e) {
      defaultProfileName = this._terminalProfileResolverService.defaultProfileName;
    }
    return defaultProfileName;
  }
};
TerminalEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, ITerminalEditorService),
  __decorateParam(5, ITerminalProfileResolverService),
  __decorateParam(6, ITerminalService),
  __decorateParam(7, ITerminalConfigurationService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IMenuService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IContextMenuService),
  __decorateParam(12, ITerminalProfileService),
  __decorateParam(13, IWorkbenchLayoutService)
], TerminalEditor);
export {
  TerminalEditor
};
