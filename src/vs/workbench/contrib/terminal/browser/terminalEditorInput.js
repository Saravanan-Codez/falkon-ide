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
import Severity from "../../../../base/common/severity.js";
import { dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { EditorInputCapabilities } from "../../../common/editor.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { ITerminalInstanceService, terminalEditorId } from "./terminal.js";
import { getColorClass, getUriClasses } from "./terminalIcon.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { TerminalExitReason, TerminalLocation, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { ILifecycleService, ShutdownReason } from "../../../services/lifecycle/common/lifecycle.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { ConfirmResult, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { Emitter } from "../../../../base/common/event.js";
let TerminalEditorInput = class extends EditorInput {
  constructor(resource, _terminalInstance, _themeService, _terminalInstanceService, _instantiationService, _configurationService, _lifecycleService, _contextKeyService, _dialogService) {
    super();
    this.resource = resource;
    this._terminalInstance = _terminalInstance;
    this._themeService = _themeService;
    this._terminalInstanceService = _terminalInstanceService;
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._lifecycleService = _lifecycleService;
    this._contextKeyService = _contextKeyService;
    this._dialogService = _dialogService;
    this.closeHandler = this;
    this._isDetached = false;
    this._isShuttingDown = false;
    this._isReverted = false;
    this._onDidRequestAttach = this._register(new Emitter());
    this.onDidRequestAttach = this._onDidRequestAttach.event;
    this._terminalEditorFocusContextKey = TerminalContextKeys.editorFocus.bindTo(_contextKeyService);
    if (_terminalInstance) {
      this._setupInstanceListeners();
    }
  }
  static {
    this.ID = "workbench.editors.terminal";
  }
  setGroup(group) {
    this._group = group;
    if (group?.scopedContextKeyService) {
      this._terminalInstance?.setParentContextKeyService(group.scopedContextKeyService);
    }
  }
  get group() {
    return this._group;
  }
  get typeId() {
    return TerminalEditorInput.ID;
  }
  get editorId() {
    return terminalEditorId;
  }
  get capabilities() {
    return EditorInputCapabilities.Readonly | EditorInputCapabilities.ForceReveal | EditorInputCapabilities.CanDropIntoEditor | EditorInputCapabilities.ForceDescription;
  }
  setTerminalInstance(instance) {
    if (this._terminalInstance) {
      throw new Error("cannot set instance that has already been set");
    }
    this._terminalInstance = instance;
    this._setupInstanceListeners();
  }
  copy() {
    const instance = this._terminalInstanceService.createInstance(this._copyLaunchConfig || {}, TerminalLocation.Editor);
    instance.focusWhenReady();
    this._copyLaunchConfig = void 0;
    return this._instantiationService.createInstance(TerminalEditorInput, instance.resource, instance);
  }
  /**
   * Sets the launch config to use for the next call to EditorInput.copy, which will be used when
   * the editor's split command is run.
   */
  setCopyLaunchConfig(launchConfig) {
    this._copyLaunchConfig = launchConfig;
  }
  /**
   * Returns the terminal instance for this input if it has not yet been detached from the input.
   */
  get terminalInstance() {
    return this._isDetached ? void 0 : this._terminalInstance;
  }
  showConfirm() {
    if (this._isReverted) {
      return false;
    }
    const confirmOnKill = this._configurationService.getValue(TerminalSettingId.ConfirmOnKill);
    if (confirmOnKill === "editor" || confirmOnKill === "always") {
      return this._terminalInstance?.hasChildProcesses || false;
    }
    return false;
  }
  async confirm(terminals) {
    const { confirmed } = await this._dialogService.confirm({
      type: Severity.Warning,
      message: localize("confirmDirtyTerminal.message", "Do you want to terminate running processes?"),
      primaryButton: localize({ key: "confirmDirtyTerminal.button", comment: ["&& denotes a mnemonic"] }, "&&Terminate"),
      detail: terminals.length > 1 ? terminals.map((terminal) => terminal.editor.getName()).join("\n") + "\n\n" + localize("confirmDirtyTerminals.detail", "Closing will terminate the running processes in the terminals.") : localize("confirmDirtyTerminal.detail", "Closing will terminate the running processes in this terminal.")
    });
    return confirmed ? ConfirmResult.DONT_SAVE : ConfirmResult.CANCEL;
  }
  async revert() {
    this._isReverted = true;
  }
  _setupInstanceListeners() {
    const instance = this._terminalInstance;
    if (!instance) {
      return;
    }
    const instanceOnDidFocusListener = instance.onDidFocus(() => this._terminalEditorFocusContextKey.set(true));
    const instanceOnDidBlurListener = instance.onDidBlur(() => this._terminalEditorFocusContextKey.reset());
    const disposeListeners = [
      instance.onExit((e) => {
        if (!instance.waitOnExit) {
          this.dispose();
        }
      }),
      instance.onDisposed(() => this.dispose()),
      instance.onTitleChanged(() => this._onDidChangeLabel.fire()),
      instance.onIconChanged(() => this._onDidChangeLabel.fire()),
      instanceOnDidFocusListener,
      instanceOnDidBlurListener,
      instance.statusList.onDidChangePrimaryStatus(() => this._onDidChangeLabel.fire())
    ];
    this._register(toDisposable(() => {
      if (!this._isDetached && !this._isShuttingDown) {
        instance.dispose(TerminalExitReason.User);
      }
      dispose(disposeListeners);
      dispose([instanceOnDidFocusListener, instanceOnDidBlurListener]);
    }));
    this._register(this._lifecycleService.onWillShutdown((e) => {
      this._isShuttingDown = true;
      dispose(disposeListeners);
      const shouldPersistTerminals = this._configurationService.getValue(TerminalSettingId.EnablePersistentSessions) && e.reason === ShutdownReason.RELOAD;
      if (shouldPersistTerminals) {
        instance.detachProcessAndDispose(TerminalExitReason.Shutdown);
      } else {
        instance.dispose(TerminalExitReason.Shutdown);
      }
    }));
  }
  getName() {
    return this._terminalInstance?.title || this.resource.fragment;
  }
  getIcon() {
    if (!this._terminalInstance || !ThemeIcon.isThemeIcon(this._terminalInstance.icon)) {
      return void 0;
    }
    return this._terminalInstance.icon;
  }
  getLabelExtraClasses() {
    if (!this._terminalInstance) {
      return [];
    }
    const extraClasses = ["terminal-tab", "predefined-file-icon"];
    const colorClass = getColorClass(this._terminalInstance);
    if (colorClass) {
      extraClasses.push(colorClass);
    }
    const uriClasses = getUriClasses(this._terminalInstance, this._themeService.getColorTheme().type);
    if (uriClasses) {
      extraClasses.push(...uriClasses);
    }
    return extraClasses;
  }
  /**
   * Detach the instance from the input such that when the input is disposed it will not dispose
   * of the terminal instance/process.
   */
  detachInstance() {
    if (!this._isShuttingDown) {
      this._terminalInstance?.detachFromElement();
      this._terminalInstance?.setParentContextKeyService(this._contextKeyService);
      this._isDetached = true;
    }
  }
  getDescription() {
    return this._terminalInstance?.description;
  }
  toUntyped() {
    return {
      resource: this.resource,
      options: {
        override: terminalEditorId,
        pinned: true,
        forceReload: true
      }
    };
  }
  canReopen() {
    return false;
  }
};
TerminalEditorInput = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, ITerminalInstanceService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ILifecycleService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IDialogService)
], TerminalEditorInput);
export {
  TerminalEditorInput
};
