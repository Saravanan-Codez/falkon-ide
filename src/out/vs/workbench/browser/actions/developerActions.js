import "./media/actions.css";
import { localize, localize2 } from "../../../nls.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { DomEmitter } from "../../../base/browser/event.js";
import { Color } from "../../../base/common/color.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { toDisposable, dispose, DisposableStore, setDisposableTracker, DisposableTracker } from "../../../base/common/lifecycle.js";
import { getDomNodePagePosition, append, $, getActiveDocument, onDidRegisterWindow, getWindows } from "../../../base/browser/dom.js";
import { createCSSRule, createStyleSheet } from "../../../base/browser/domStylesheets.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../platform/contextkey/common/contextkey.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { RunOnceScheduler } from "../../../base/common/async.js";
import { ILayoutService } from "../../../platform/layout/browser/layoutService.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { registerAction2, Action2, MenuRegistry } from "../../../platform/actions/common/actions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../platform/storage/common/storage.js";
import { clamp } from "../../../base/common/numbers.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { Extensions as ConfigurationExtensions } from "../../../platform/configuration/common/configurationRegistry.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { IWorkingCopyService } from "../../services/workingCopy/common/workingCopyService.js";
import { Categories } from "../../../platform/action/common/actionCommonCategories.js";
import { IWorkingCopyBackupService } from "../../services/workingCopy/common/workingCopyBackup.js";
import { ResultKind } from "../../../platform/keybinding/common/keybindingResolver.js";
import { IDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { IOutputService } from "../../services/output/common/output.js";
import { windowLogId } from "../../services/log/common/logConstants.js";
import { ByteSize } from "../../../platform/files/common/files.js";
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { IUserDataProfileService } from "../../services/userDataProfile/common/userDataProfile.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import product from "../../../platform/product/common/product.js";
import { CommandsRegistry } from "../../../platform/commands/common/commands.js";
import { IEnvironmentService } from "../../../platform/environment/common/environment.js";
import { IProductService } from "../../../platform/product/common/productService.js";
import { IDefaultAccountService } from "../../../platform/defaultAccount/common/defaultAccount.js";
import { IAuthenticationService } from "../../services/authentication/common/authentication.js";
import { IAuthenticationAccessService } from "../../services/authentication/browser/authenticationAccessService.js";
import { IPolicyService, PolicyValueSource } from "../../../platform/policy/common/policy.js";
import { COPILOT_ENABLED_PLUGINS_KEY, COPILOT_EXTRA_MARKETPLACES_KEY, COPILOT_STRICT_MARKETPLACES_KEY, INativeManagedSettingsService, IFileManagedSettingsService, normalizeManagedSettings, projectManagedSettings, pickManagedSettings } from "../../../platform/policy/common/copilotManagedSettings.js";
import { APPROVED_ACCOUNT_ORGANIZATIONS_POLICY_NAME, IAccountPolicyGateService } from "../../services/policies/common/accountPolicyService.js";
import { adaptManagedSettings } from "../../services/accounts/browser/managedSettings.js";
import { isObject } from "../../../base/common/types.js";
import * as json from "../../../base/common/json.js";
import { getParseErrorMessage } from "../../../base/common/jsonErrorMessages.js";
import { IAgentHostService } from "../../../platform/agentHost/common/agentService.js";
import { IAgentHostEnablementService } from "../../../platform/agentHost/common/agentHostEnablementService.js";
class InspectContextKeysAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.inspectContextKeys",
      title: localize2("inspect context keys", "Inspect Context Keys"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    const contextKeyService = accessor.get(IContextKeyService);
    const disposables = new DisposableStore();
    const stylesheet = createStyleSheet(void 0, void 0, disposables);
    createCSSRule("*", "cursor: crosshair !important;", stylesheet);
    const hoverFeedback = document.createElement("div");
    const activeDocument = getActiveDocument();
    activeDocument.body.appendChild(hoverFeedback);
    disposables.add(toDisposable(() => hoverFeedback.remove()));
    hoverFeedback.style.position = "absolute";
    hoverFeedback.style.pointerEvents = "none";
    hoverFeedback.style.backgroundColor = "rgba(255, 0, 0, 0.5)";
    hoverFeedback.style.zIndex = "1000";
    const onMouseMove = disposables.add(new DomEmitter(activeDocument, "mousemove", true));
    disposables.add(onMouseMove.event((e) => {
      const target = e.target;
      const position = getDomNodePagePosition(target);
      hoverFeedback.style.top = `${position.top}px`;
      hoverFeedback.style.left = `${position.left}px`;
      hoverFeedback.style.width = `${position.width}px`;
      hoverFeedback.style.height = `${position.height}px`;
    }));
    const onMouseDown = disposables.add(new DomEmitter(activeDocument, "mousedown", true));
    Event.once(onMouseDown.event)((e) => {
      e.preventDefault();
      e.stopPropagation();
    }, null, disposables);
    const onMouseUp = disposables.add(new DomEmitter(activeDocument, "mouseup", true));
    Event.once(onMouseUp.event)((e) => {
      e.preventDefault();
      e.stopPropagation();
      const context = contextKeyService.getContext(e.target);
      console.log(context.collectAllValues());
      dispose(disposables);
    }, null, disposables);
  }
}
class ToggleScreencastModeAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleScreencastMode",
      title: localize2("toggle screencast mode", "Toggle Screencast Mode"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    if (ToggleScreencastModeAction.disposable) {
      ToggleScreencastModeAction.disposable.dispose();
      ToggleScreencastModeAction.disposable = void 0;
      return;
    }
    const layoutService = accessor.get(ILayoutService);
    const configurationService = accessor.get(IConfigurationService);
    const keybindingService = accessor.get(IKeybindingService);
    const disposables = new DisposableStore();
    const container = layoutService.activeContainer;
    const mouseMarker = append(container, $(".screencast-mouse"));
    disposables.add(toDisposable(() => mouseMarker.remove()));
    const keyboardMarker = append(container, $(".screencast-keyboard"));
    disposables.add(toDisposable(() => keyboardMarker.remove()));
    const onMouseDown = disposables.add(new Emitter());
    const onMouseUp = disposables.add(new Emitter());
    const onMouseMove = disposables.add(new Emitter());
    function registerContainerListeners(container2, windowDisposables) {
      const listeners = new DisposableStore();
      listeners.add(listeners.add(new DomEmitter(container2, "mousedown", true)).event((e) => onMouseDown.fire(e)));
      listeners.add(listeners.add(new DomEmitter(container2, "mouseup", true)).event((e) => onMouseUp.fire(e)));
      listeners.add(listeners.add(new DomEmitter(container2, "mousemove", true)).event((e) => onMouseMove.fire(e)));
      windowDisposables.add(listeners);
      disposables.add(toDisposable(() => windowDisposables.delete(listeners)));
      disposables.add(listeners);
    }
    for (const { window, disposables: disposables2 } of getWindows()) {
      registerContainerListeners(layoutService.getContainer(window), disposables2);
    }
    disposables.add(onDidRegisterWindow(({ window, disposables: disposables2 }) => registerContainerListeners(layoutService.getContainer(window), disposables2)));
    disposables.add(layoutService.onDidChangeActiveContainer(() => {
      layoutService.activeContainer.appendChild(mouseMarker);
      layoutService.activeContainer.appendChild(keyboardMarker);
    }));
    const updateMouseIndicatorColor = () => {
      mouseMarker.style.borderColor = Color.fromHex(configurationService.getValue("screencastMode.mouseIndicatorColor")).toString();
    };
    let mouseIndicatorSize;
    const updateMouseIndicatorSize = () => {
      mouseIndicatorSize = clamp(configurationService.getValue("screencastMode.mouseIndicatorSize") || 20, 20, 100);
      mouseMarker.style.height = `${mouseIndicatorSize}px`;
      mouseMarker.style.width = `${mouseIndicatorSize}px`;
    };
    updateMouseIndicatorColor();
    updateMouseIndicatorSize();
    disposables.add(onMouseDown.event((e) => {
      mouseMarker.style.top = `${e.clientY - mouseIndicatorSize / 2}px`;
      mouseMarker.style.left = `${e.clientX - mouseIndicatorSize / 2}px`;
      mouseMarker.style.display = "block";
      mouseMarker.style.transform = `scale(${1})`;
      mouseMarker.style.transition = "transform 0.1s";
      const mouseMoveListener = onMouseMove.event((e2) => {
        mouseMarker.style.top = `${e2.clientY - mouseIndicatorSize / 2}px`;
        mouseMarker.style.left = `${e2.clientX - mouseIndicatorSize / 2}px`;
        mouseMarker.style.transform = `scale(${0.8})`;
      });
      Event.once(onMouseUp.event)(() => {
        mouseMarker.style.display = "none";
        mouseMoveListener.dispose();
      });
    }));
    const updateKeyboardFontSize = () => {
      keyboardMarker.style.fontSize = `${clamp(configurationService.getValue("screencastMode.fontSize") || 56, 20, 100)}px`;
    };
    const updateKeyboardMarker = () => {
      keyboardMarker.style.bottom = `${clamp(configurationService.getValue("screencastMode.verticalOffset") || 0, 0, 90)}%`;
    };
    let keyboardMarkerTimeout;
    const updateKeyboardMarkerTimeout = () => {
      keyboardMarkerTimeout = clamp(configurationService.getValue("screencastMode.keyboardOverlayTimeout") || 800, 500, 5e3);
    };
    updateKeyboardFontSize();
    updateKeyboardMarker();
    updateKeyboardMarkerTimeout();
    disposables.add(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("screencastMode.verticalOffset")) {
        updateKeyboardMarker();
      }
      if (e.affectsConfiguration("screencastMode.fontSize")) {
        updateKeyboardFontSize();
      }
      if (e.affectsConfiguration("screencastMode.keyboardOverlayTimeout")) {
        updateKeyboardMarkerTimeout();
      }
      if (e.affectsConfiguration("screencastMode.mouseIndicatorColor")) {
        updateMouseIndicatorColor();
      }
      if (e.affectsConfiguration("screencastMode.mouseIndicatorSize")) {
        updateMouseIndicatorSize();
      }
    }));
    const onKeyDown = disposables.add(new Emitter());
    const onCompositionStart = disposables.add(new Emitter());
    const onCompositionUpdate = disposables.add(new Emitter());
    const onCompositionEnd = disposables.add(new Emitter());
    function registerWindowListeners(window, windowDisposables) {
      const listeners = new DisposableStore();
      listeners.add(listeners.add(new DomEmitter(window, "keydown", true)).event((e) => onKeyDown.fire(e)));
      listeners.add(listeners.add(new DomEmitter(window, "compositionstart", true)).event((e) => onCompositionStart.fire(e)));
      listeners.add(listeners.add(new DomEmitter(window, "compositionupdate", true)).event((e) => onCompositionUpdate.fire(e)));
      listeners.add(listeners.add(new DomEmitter(window, "compositionend", true)).event((e) => onCompositionEnd.fire(e)));
      windowDisposables.add(listeners);
      disposables.add(toDisposable(() => windowDisposables.delete(listeners)));
      disposables.add(listeners);
    }
    for (const { window, disposables: disposables2 } of getWindows()) {
      registerWindowListeners(window, disposables2);
    }
    disposables.add(onDidRegisterWindow(({ window, disposables: disposables2 }) => registerWindowListeners(window, disposables2)));
    let length = 0;
    let composing = void 0;
    let imeBackSpace = false;
    const clearKeyboardScheduler = disposables.add(new RunOnceScheduler(() => {
      keyboardMarker.textContent = "";
      composing = void 0;
      length = 0;
    }, keyboardMarkerTimeout));
    disposables.add(onCompositionStart.event((e) => {
      imeBackSpace = true;
    }));
    disposables.add(onCompositionUpdate.event((e) => {
      if (e.data && imeBackSpace) {
        if (length > 20) {
          keyboardMarker.innerText = "";
          length = 0;
        }
        composing = composing ?? append(keyboardMarker, $("span.key"));
        composing.textContent = e.data;
      } else if (imeBackSpace) {
        keyboardMarker.innerText = "";
        append(keyboardMarker, $("span.key", {}, `Backspace`));
      }
      clearKeyboardScheduler.schedule(keyboardMarkerTimeout);
    }));
    disposables.add(onCompositionEnd.event((e) => {
      composing = void 0;
      length++;
    }));
    disposables.add(onKeyDown.event((e) => {
      if (e.key === "Process" || /[\uac00-\ud787\u3131-\u314e\u314f-\u3163\u3041-\u3094\u30a1-\u30f4\u30fc\u3005\u3006\u3024\u4e00-\u9fa5]/u.test(e.key)) {
        if (e.code === "Backspace") {
          imeBackSpace = true;
        } else if (!e.code.includes("Key")) {
          composing = void 0;
          imeBackSpace = false;
        } else {
          imeBackSpace = true;
        }
        clearKeyboardScheduler.schedule(keyboardMarkerTimeout);
        return;
      }
      if (e.isComposing) {
        return;
      }
      const options = configurationService.getValue("screencastMode.keyboardOptions");
      const event = new StandardKeyboardEvent(e);
      const shortcut = keybindingService.softDispatch(event, event.target);
      if (shortcut.kind === ResultKind.KbFound && shortcut.commandId && !(options.showSingleEditorCursorMoves ?? true) && ["cursorLeft", "cursorRight", "cursorUp", "cursorDown"].includes(shortcut.commandId)) {
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || length > 20 || event.keyCode === KeyCode.Backspace || event.keyCode === KeyCode.Escape || event.keyCode === KeyCode.UpArrow || event.keyCode === KeyCode.DownArrow || event.keyCode === KeyCode.LeftArrow || event.keyCode === KeyCode.RightArrow) {
        keyboardMarker.innerText = "";
        length = 0;
      }
      const keybinding = keybindingService.resolveKeyboardEvent(event);
      const commandDetails = this._isKbFound(shortcut) && shortcut.commandId ? this.getCommandDetails(shortcut.commandId) : void 0;
      let commandAndGroupLabel = commandDetails?.title;
      let keyLabel = keybinding.getLabel();
      if (commandDetails) {
        if ((options.showCommandGroups ?? false) && commandDetails.category) {
          commandAndGroupLabel = `${commandDetails.category}: ${commandAndGroupLabel} `;
        }
        if (this._isKbFound(shortcut) && shortcut.commandId) {
          const keybindings = keybindingService.lookupKeybindings(shortcut.commandId).filter((k) => k.getLabel()?.endsWith(keyLabel ?? ""));
          if (keybindings.length > 0) {
            keyLabel = keybindings[keybindings.length - 1].getLabel();
          }
        }
      }
      if ((options.showCommands ?? true) && commandAndGroupLabel) {
        append(keyboardMarker, $("span.title", {}, `${commandAndGroupLabel} `));
      }
      if ((options.showKeys ?? true) || (options.showKeybindings ?? true) && this._isKbFound(shortcut)) {
        keyLabel = keyLabel?.replace("UpArrow", "\u2191")?.replace("DownArrow", "\u2193")?.replace("LeftArrow", "\u2190")?.replace("RightArrow", "\u2192");
        append(keyboardMarker, $("span.key", {}, keyLabel ?? ""));
      }
      length++;
      clearKeyboardScheduler.schedule(keyboardMarkerTimeout);
    }));
    ToggleScreencastModeAction.disposable = disposables;
  }
  _isKbFound(resolutionResult) {
    return resolutionResult.kind === ResultKind.KbFound;
  }
  getCommandDetails(commandId) {
    const fromMenuRegistry = MenuRegistry.getCommand(commandId);
    if (fromMenuRegistry) {
      return {
        title: typeof fromMenuRegistry.title === "string" ? fromMenuRegistry.title : fromMenuRegistry.title.value,
        category: fromMenuRegistry.category ? typeof fromMenuRegistry.category === "string" ? fromMenuRegistry.category : fromMenuRegistry.category.value : void 0
      };
    }
    const fromCommandsRegistry = CommandsRegistry.getCommand(commandId);
    if (fromCommandsRegistry?.metadata?.description) {
      return { title: typeof fromCommandsRegistry.metadata.description === "string" ? fromCommandsRegistry.metadata.description : fromCommandsRegistry.metadata.description.value };
    }
    return void 0;
  }
}
class LogStorageAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.logStorage",
      title: localize2({ key: "logStorage", comment: ["A developer only action to log the contents of the storage for the current window."] }, "Log Storage Database Contents"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    const storageService = accessor.get(IStorageService);
    const dialogService = accessor.get(IDialogService);
    storageService.log();
    dialogService.info(localize("storageLogDialogMessage", "The storage database contents have been logged to the developer tools."), localize("storageLogDialogDetails", "Open developer tools from the menu and select the Console tab."));
  }
}
class LogWorkingCopiesAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.logWorkingCopies",
      title: localize2({ key: "logWorkingCopies", comment: ["A developer only action to log the working copies that exist."] }, "Log Working Copies"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const workingCopyService = accessor.get(IWorkingCopyService);
    const workingCopyBackupService = accessor.get(IWorkingCopyBackupService);
    const logService = accessor.get(ILogService);
    const outputService = accessor.get(IOutputService);
    const backups = await workingCopyBackupService.getBackups();
    const msg = [
      ``,
      `[Working Copies]`,
      ...workingCopyService.workingCopies.length > 0 ? workingCopyService.workingCopies.map((workingCopy) => `${workingCopy.isDirty() ? "\u25CF " : ""}${workingCopy.resource.toString(true)} (typeId: ${workingCopy.typeId || "<no typeId>"})`) : ["<none>"],
      ``,
      `[Backups]`,
      ...backups.length > 0 ? backups.map((backup) => `${backup.resource.toString(true)} (typeId: ${backup.typeId || "<no typeId>"})`) : ["<none>"]
    ];
    logService.info(msg.join("\n"));
    outputService.showChannel(windowLogId, true);
  }
}
class RemoveLargeStorageEntriesAction extends Action2 {
  static {
    this.SIZE_THRESHOLD = 1024 * 16;
  }
  // 16kb
  constructor() {
    super({
      id: "workbench.action.removeLargeStorageDatabaseEntries",
      title: localize2("removeLargeStorageDatabaseEntries", "Remove Large Storage Database Entries..."),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const storageService = accessor.get(IStorageService);
    const quickInputService = accessor.get(IQuickInputService);
    const userDataProfileService = accessor.get(IUserDataProfileService);
    const dialogService = accessor.get(IDialogService);
    const environmentService = accessor.get(IEnvironmentService);
    const items = [];
    for (const scope of [StorageScope.APPLICATION, StorageScope.PROFILE, StorageScope.WORKSPACE]) {
      if (scope === StorageScope.PROFILE && userDataProfileService.currentProfile.isDefault) {
        continue;
      }
      for (const target of [StorageTarget.MACHINE, StorageTarget.USER]) {
        for (const key of storageService.keys(scope, target)) {
          const value = storageService.get(key, scope);
          if (value && (!environmentService.isBuilt || value.length > RemoveLargeStorageEntriesAction.SIZE_THRESHOLD)) {
            items.push({
              key,
              scope,
              target,
              size: value.length,
              label: key,
              description: ByteSize.formatSize(value.length),
              detail: localize("largeStorageItemDetail", "Scope: {0}, Target: {1}", scope === StorageScope.APPLICATION ? localize("global", "Global") : scope === StorageScope.PROFILE ? localize("profile", "Profile") : localize("workspace", "Workspace"), target === StorageTarget.MACHINE ? localize("machine", "Machine") : localize("user", "User"))
            });
          }
        }
      }
    }
    items.sort((itemA, itemB) => itemB.size - itemA.size);
    const selectedItems = await new Promise((resolve) => {
      const disposables = new DisposableStore();
      const picker = disposables.add(quickInputService.createQuickPick());
      picker.items = items;
      picker.canSelectMany = true;
      picker.ok = false;
      picker.customButton = true;
      picker.hideCheckAll = true;
      picker.customLabel = localize("removeLargeStorageEntriesPickerButton", "Remove");
      picker.placeholder = localize("removeLargeStorageEntriesPickerPlaceholder", "Select large entries to remove from storage");
      if (items.length === 0) {
        picker.description = localize("removeLargeStorageEntriesPickerDescriptionNoEntries", "There are no large storage entries to remove.");
      }
      picker.show();
      disposables.add(picker.onDidCustom(() => {
        resolve(picker.selectedItems);
        picker.hide();
      }));
      disposables.add(picker.onDidHide(() => disposables.dispose()));
    });
    if (selectedItems.length === 0) {
      return;
    }
    const { confirmed } = await dialogService.confirm({
      type: "warning",
      message: localize("removeLargeStorageEntriesConfirmRemove", "Do you want to remove the selected storage entries from the database?"),
      detail: localize("removeLargeStorageEntriesConfirmRemoveDetail", "{0}\n\nThis action is irreversible and may result in data loss!", selectedItems.map((item) => item.label).join("\n")),
      primaryButton: localize({ key: "removeLargeStorageEntriesButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Remove")
    });
    if (!confirmed) {
      return;
    }
    const scopesToOptimize = /* @__PURE__ */ new Set();
    for (const item of selectedItems) {
      storageService.remove(item.key, item.scope);
      scopesToOptimize.add(item.scope);
    }
    for (const scope of scopesToOptimize) {
      await storageService.optimize(scope);
    }
  }
}
let tracker = void 0;
let trackedDisposables = /* @__PURE__ */ new Set();
const DisposablesSnapshotStateContext = new RawContextKey("dirtyWorkingCopies", "stopped");
class StartTrackDisposables extends Action2 {
  constructor() {
    super({
      id: "workbench.action.startTrackDisposables",
      title: localize2("startTrackDisposables", "Start Tracking Disposables"),
      category: Categories.Developer,
      f1: true,
      precondition: ContextKeyExpr.and(DisposablesSnapshotStateContext.isEqualTo("pending").negate(), DisposablesSnapshotStateContext.isEqualTo("started").negate())
    });
  }
  run(accessor) {
    const disposablesSnapshotStateContext = DisposablesSnapshotStateContext.bindTo(accessor.get(IContextKeyService));
    disposablesSnapshotStateContext.set("started");
    trackedDisposables.clear();
    tracker = new DisposableTracker();
    setDisposableTracker(tracker);
  }
}
class SnapshotTrackedDisposables extends Action2 {
  constructor() {
    super({
      id: "workbench.action.snapshotTrackedDisposables",
      title: localize2("snapshotTrackedDisposables", "Snapshot Tracked Disposables"),
      category: Categories.Developer,
      f1: true,
      precondition: DisposablesSnapshotStateContext.isEqualTo("started")
    });
  }
  run(accessor) {
    const disposablesSnapshotStateContext = DisposablesSnapshotStateContext.bindTo(accessor.get(IContextKeyService));
    disposablesSnapshotStateContext.set("pending");
    trackedDisposables = new Set(tracker?.computeLeakingDisposables(1e3)?.leaks.map((disposable) => disposable.value));
  }
}
class StopTrackDisposables extends Action2 {
  constructor() {
    super({
      id: "workbench.action.stopTrackDisposables",
      title: localize2("stopTrackDisposables", "Stop Tracking Disposables"),
      category: Categories.Developer,
      f1: true,
      precondition: DisposablesSnapshotStateContext.isEqualTo("pending")
    });
  }
  run(accessor) {
    const editorService = accessor.get(IEditorService);
    const disposablesSnapshotStateContext = DisposablesSnapshotStateContext.bindTo(accessor.get(IContextKeyService));
    disposablesSnapshotStateContext.set("stopped");
    if (tracker) {
      const disposableLeaks = /* @__PURE__ */ new Set();
      for (const disposable of new Set(tracker.computeLeakingDisposables(1e3)?.leaks) ?? []) {
        if (trackedDisposables.has(disposable.value)) {
          disposableLeaks.add(disposable);
        }
      }
      const leaks = tracker.computeLeakingDisposables(1e3, Array.from(disposableLeaks));
      if (leaks) {
        editorService.openEditor({ resource: void 0, contents: leaks.details });
      }
    }
    setDisposableTracker(null);
    tracker = void 0;
    trackedDisposables.clear();
  }
}
function managedSettingsSourceLabel(source) {
  switch (source) {
    case "server":
      return "GitHub Server API";
    case "nativeMdm":
      return "Native MDM";
    case "file":
      return "File (managed-settings.json)";
    case "none":
      return "None (no managed settings active)";
  }
}
function managedSettingsSourceShortLabel(source) {
  switch (source) {
    case "server":
      return "Server";
    case "nativeMdm":
      return "Native MDM";
    case "file":
      return "File";
    case "none":
      return "None";
  }
}
function policyValueSourceLabel(source) {
  switch (source) {
    case PolicyValueSource.Device:
      return "Device";
    case PolicyValueSource.NativeMdm:
      return "Managed Settings: Native MDM";
    case PolicyValueSource.ServerManagedSettings:
      return "Managed Settings: Server";
    case PolicyValueSource.FileManagedSettings:
      return "Managed Settings: File";
    case PolicyValueSource.MixedManagedSettings:
      return "Managed Settings: Mixed";
    case PolicyValueSource.Account:
      return "Account";
    case PolicyValueSource.AccountGate:
      return "Account Policy Gate";
    case void 0:
      return "Unknown";
  }
}
function jsonBlock(value) {
  return "```json\n" + JSON.stringify(value ?? {}, null, 2) + "\n```\n\n";
}
function managedSettingsPipeline(rawLabel, raw, normalized, projected, rawUnavailableMessage) {
  let content = `**${rawLabel}**

`;
  content += raw === void 0 ? `*${rawUnavailableMessage ?? "Unavailable"}*

` : jsonBlock(raw);
  content += "**Normalized bag**\n\n";
  content += jsonBlock(normalized);
  content += "**VS Code policy projection**\n\n";
  content += jsonBlock(projected);
  return content;
}
function managedValueCell(value) {
  if (value === void 0) {
    return "\u2014";
  }
  return `\`${JSON.stringify(value).replace(/\|/g, "\\|")}\``;
}
const PROPERTY_VALUE_TABLE_HEADER = "| Property | Value |\n|----------|-------|\n";
class PolicyDiagnosticsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.showPolicyDiagnostics",
      title: localize2("policyDiagnostics", "Policy Diagnostics"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const configurationService = accessor.get(IConfigurationService);
    const productService = accessor.get(IProductService);
    const defaultAccountService = accessor.get(IDefaultAccountService);
    const authenticationService = accessor.get(IAuthenticationService);
    const authenticationAccessService = accessor.get(IAuthenticationAccessService);
    const policyService = accessor.get(IPolicyService);
    const accountPolicyGateService = accessor.get(IAccountPolicyGateService);
    const agentHostService = accessor.get(IAgentHostService);
    const agentHostEnablementService = accessor.get(IAgentHostEnablementService);
    let nativeManagedSettingsService;
    try {
      nativeManagedSettingsService = accessor.get(INativeManagedSettingsService);
    } catch {
    }
    let fileManagedSettingsService;
    try {
      fileManagedSettingsService = accessor.get(IFileManagedSettingsService);
    } catch {
    }
    const configurationRegistry2 = Registry.as(ConfigurationExtensions.Configuration);
    let content = "# VS Code Policy Diagnostics\n\n";
    content += "*WARNING: This file may contain sensitive information.*\n\n";
    content += "## System Information\n\n";
    content += PROPERTY_VALUE_TABLE_HEADER;
    content += `| Generated | ${(/* @__PURE__ */ new Date()).toISOString()} |
`;
    content += `| Product | ${productService.nameLong} ${productService.version} |
`;
    content += `| Commit | ${productService.commit || "n/a"} |

`;
    content += "## Account Information\n\n";
    try {
      const account = await defaultAccountService.getDefaultAccount();
      const sensitiveKeys = ["sessionId", "analytics_tracking_id"];
      if (account) {
        let username = "Unknown";
        let accountLabel = "Unknown";
        try {
          const providerIds = authenticationService.getProviderIds();
          for (const providerId of providerIds) {
            const sessions = await authenticationService.getSessions(providerId);
            const matchingSession = sessions.find((session) => session.id === account.sessionId);
            if (matchingSession) {
              username = matchingSession.account.id;
              accountLabel = matchingSession.account.label;
              break;
            }
          }
        } catch (error) {
        }
        content += "### Default Account Summary\n\n";
        content += `**Account ID/Username**: ${username}

`;
        content += `**Account Label**: ${accountLabel}

`;
        content += "### Detailed Account Properties\n\n";
        content += PROPERTY_VALUE_TABLE_HEADER;
        for (const [key, value] of Object.entries(account)) {
          if (value !== void 0 && value !== null) {
            let displayValue;
            if (sensitiveKeys.includes(key)) {
              displayValue = "***";
            } else if (typeof value === "object") {
              displayValue = JSON.stringify(value);
            } else {
              displayValue = String(value);
            }
            content += `| ${key} | ${displayValue} |
`;
          }
        }
        const policyData = defaultAccountService.policyData;
        content += `| policyData | ${policyData ? JSON.stringify(policyData) : "No Policy Data"} |
`;
        content += "\n";
      } else {
        content += "*No default account configured*\n\n";
      }
    } catch (error) {
      content += `*Error retrieving account information: ${error}*

`;
    }
    content += "## Account Policy Gate\n\n";
    try {
      const gateInfo = accountPolicyGateService.gateInfo;
      const approvedOrgsRaw = policyService.getPolicyValue(APPROVED_ACCOUNT_ORGANIZATIONS_POLICY_NAME);
      content += PROPERTY_VALUE_TABLE_HEADER;
      content += `| State | \`${gateInfo.state}\` |
`;
      content += `| Reason | ${gateInfo.reason ? `\`${gateInfo.reason}\`` : "*n/a*"} |
`;
      content += `| ${APPROVED_ACCOUNT_ORGANIZATIONS_POLICY_NAME} | ${approvedOrgsRaw !== void 0 ? `\`${String(approvedOrgsRaw)}\`` : "*not set*"} |
`;
      content += "\n";
      content += "**Legend**\n\n";
      content += "- `inactive`: gate disabled (no approved orgs configured) \u2014 policies behave as account data dictates.\n";
      content += "- `satisfied`: gate active and approved \u2014 account policy values flow normally.\n";
      content += "- `restricted`: gate active and not satisfied \u2014 opted-in policies forced to their restricted value.\n";
      content += "  - `noAccount`: no default account signed in.\n";
      content += "  - `wrongProvider`: signed in with a non-GitHub provider.\n";
      content += "  - `orgNotApproved`: signed in but account is not a member of any approved organization.\n";
      content += "  - `policyNotResolved`: signed in to an approved org but account-side policy data has not yet been fetched.\n\n";
    } catch (error) {
      content += `*Error retrieving account policy gate info: ${error}*

`;
    }
    content += "## Managed Settings\n\n";
    try {
      const policyData = defaultAccountService.policyData;
      const serverManagedSettings = policyData?.managedSettings ?? {};
      const nativeManagedSettings = nativeManagedSettingsService?.managedSettings ?? {};
      const fileManagedSettings = fileManagedSettingsService?.managedSettings ?? {};
      const fileRawManagedSettings = fileManagedSettingsService?.rawManagedSettings;
      const declaredDefinitions = {};
      for (const property of [...Object.values(configurationRegistry2.getConfigurationProperties()), ...Object.values(configurationRegistry2.getExcludedConfigurationProperties())]) {
        const declared = property.policy?.managedSettings;
        if (declared) {
          Object.assign(declaredDefinitions, declared);
        }
      }
      const pick = pickManagedSettings(nativeManagedSettings, serverManagedSettings, fileManagedSettings);
      content += `**Active sources** (in precedence order): ${pick.activeSources.length > 0 ? pick.activeSources.map(managedSettingsSourceLabel).join(", ") : managedSettingsSourceLabel("none")}

`;
      content += "*Precedence is resolved per key: native MDM wins over the server endpoint, which wins over the file on disk. A key left unset by a higher channel is still filled in by a lower one.*\n\n";
      const parseErrors = [];
      const projectChannel = (channel, values) => projectManagedSettings(
        values,
        declaredDefinitions,
        (message) => parseErrors.push({ stage: `${channel}: project`, message })
      );
      const channelContributes = (channel) => pick.activeSources.includes(channel);
      const nativeProjected = projectChannel("nativeMdm", nativeManagedSettings);
      const serverProjected = projectChannel("server", serverManagedSettings);
      const fileProjected = projectChannel("file", fileManagedSettings);
      const effective = projectManagedSettings(pick.values, declaredDefinitions, (message) => parseErrors.push({ stage: "effective: project", message }));
      content += "### VS Code Managed-Settings Schema\n\n";
      content += "*Only keys declared here can reach VS Code policy callbacks. Runtime-owned keys may still be enforced by the Copilot runtime even when absent from the projections below.*\n\n";
      content += jsonBlock(declaredDefinitions);
      content += "### Native MDM\n\n";
      content += PROPERTY_VALUE_TABLE_HEADER;
      content += `| Available | ${nativeManagedSettingsService ? "yes" : "no"} |
`;
      content += `| Contributes winning keys | ${channelContributes("nativeMdm") ? "yes" : "no"} |

`;
      if (nativeManagedSettingsService) {
        content += "*The native policy watcher exposes only declared scalar keys, so its source values are already definition-scoped and canonical.*\n\n";
        content += managedSettingsPipeline("Source values (definition-scoped)", nativeManagedSettings, nativeManagedSettings, nativeProjected);
      }
      content += "### GitHub Server API\n\n";
      content += PROPERTY_VALUE_TABLE_HEADER;
      content += "| Endpoint | `/copilot_internal/managed_settings` |\n";
      const fetchStatus = defaultAccountService.managedSettingsFetchStatus;
      content += `| Last fetch | ${fetchStatus === null ? "*never*" : `\`${fetchStatus}\``} |
`;
      const fetchedAt = defaultAccountService.managedSettingsFetchedAt;
      content += `| Last successful fetch | ${fetchedAt ? new Date(fetchedAt).toLocaleString() : "*n/a*"} |
`;
      content += `| Contributes winning keys | ${channelContributes("server") ? "yes" : "no"} |

`;
      const rawResponse = defaultAccountService.managedSettingsRawResponse;
      if (isObject(rawResponse)) {
        adaptManagedSettings(rawResponse, (message) => parseErrors.push({ stage: "adapt", message }));
      }
      content += managedSettingsPipeline(
        "Raw response (last successful fetch)",
        isObject(rawResponse) ? rawResponse : void 0,
        serverManagedSettings,
        serverProjected,
        "No successful managed-settings response has been captured."
      );
      content += "### File (managed-settings.json)\n\n";
      content += PROPERTY_VALUE_TABLE_HEADER;
      content += `| Available | ${fileManagedSettingsService ? "yes" : "no"} |
`;
      content += `| Contributes winning keys | ${channelContributes("file") ? "yes" : "no"} |

`;
      if (fileManagedSettingsService) {
        if (fileRawManagedSettings) {
          normalizeManagedSettings(fileRawManagedSettings, (message) => parseErrors.push({ stage: "file: normalize", message }));
        }
        content += managedSettingsPipeline("Raw parsed file", fileRawManagedSettings, fileManagedSettings, fileProjected);
      }
      content += "### Effective Resolution\n\n";
      content += "**Merged normalized bag**\n\n";
      content += jsonBlock(pick.values);
      content += "**Effective VS Code policy bag**\n\n";
      content += jsonBlock(effective);
      content += "**Per-key precedence**\n\n";
      if (pick.resolutions.size > 0) {
        content += "| Key | Effective | Winning Source | Native MDM | Server | File |\n";
        content += "|-----|-----------|----------------|------------|--------|------|\n";
        const channelValue = (resolution, channel) => {
          const contribution = resolution.contributions.find((c) => c.channel === channel);
          if (!contribution) {
            return "\u2014";
          }
          const cell = managedValueCell(contribution.value);
          return channel === resolution.source ? cell : `~~${cell}~~`;
        };
        for (const key of [...pick.resolutions.keys()].sort()) {
          const resolution = pick.resolutions.get(key);
          content += `| ${key} | ${managedValueCell(resolution.value)} | ${managedSettingsSourceShortLabel(resolution.source)} | ${channelValue(resolution, "nativeMdm")} | ${channelValue(resolution, "server")} | ${channelValue(resolution, "file")} |
`;
        }
        content += "\n";
        content += "*Struck-through values were supplied by a channel but overridden by a higher-precedence channel for that key.*\n\n";
      } else {
        content += "*No managed-settings keys are supplied by any channel.*\n\n";
      }
      content += "### Agent Runtime Resolution\n\n";
      content += "*Resolved independently by each provider through its own SDK/runtime. This may include runtime-owned keys that VS Code does not declare as configuration policies.*\n\n";
      if (!agentHostEnablementService.enabled.get()) {
        content += "*Agent Host is disabled; runtime managed-settings diagnostics were not queried.*\n\n";
      } else {
        try {
          const runtimeDiagnostics = await agentHostService.getManagedSettingsDiagnostics();
          if (runtimeDiagnostics.length === 0) {
            content += "*No agent provider exposes managed-settings diagnostics.*\n\n";
          }
          for (const diagnostic of runtimeDiagnostics) {
            content += `#### ${diagnostic.provider}

`;
            if (diagnostic.error) {
              content += `*Probe failed: ${diagnostic.error}*

`;
            } else {
              content += jsonBlock(diagnostic.snapshot);
            }
          }
        } catch (error) {
          content += `*Agent runtime diagnostics unavailable: ${error}*

`;
        }
      }
      for (const key of [COPILOT_ENABLED_PLUGINS_KEY, COPILOT_STRICT_MARKETPLACES_KEY, COPILOT_EXTRA_MARKETPLACES_KEY]) {
        const value = effective[key];
        if (typeof value !== "string") {
          continue;
        }
        const jsonErrors = [];
        json.parse(value, jsonErrors);
        for (const e of jsonErrors) {
          parseErrors.push({ stage: "parse", message: `${key} @ offset ${e.offset}: ${getParseErrorMessage(e.error)}` });
        }
      }
      content += `### Normalization and Parse Issues (${parseErrors.length})

`;
      if (parseErrors.length > 0) {
        content += "| Stage | Message |\n";
        content += "|-------|---------|\n";
        for (const { stage, message } of parseErrors) {
          content += `| ${stage} | ${message.replace(/\|/g, "\\|")} |
`;
        }
        content += "\n";
      } else {
        content += "*None.*\n\n";
      }
    } catch (error) {
      content += `*Error rendering managed settings diagnostics: ${error}*

`;
    }
    content += "## Policy-Controlled Settings\n\n";
    const policyConfigurations = configurationRegistry2.getPolicyConfigurations();
    const policyReferenceConfigurations = configurationRegistry2.getPolicyReferenceConfigurations();
    const configurationProperties = configurationRegistry2.getConfigurationProperties();
    const excludedProperties = configurationRegistry2.getExcludedConfigurationProperties();
    if (policyConfigurations.size > 0 || policyReferenceConfigurations.size > 0) {
      const appliedPolicy = [];
      const notAppliedPolicy = [];
      const collectPolicySetting = (policyName, settingKey) => {
        const property = configurationProperties[settingKey] ?? excludedProperties[settingKey];
        if (property) {
          const inspectValue = configurationService.inspect(settingKey);
          const settingInfo = {
            name: policyName,
            key: settingKey,
            property,
            inspection: inspectValue
          };
          if (inspectValue.policyValue !== void 0) {
            appliedPolicy.push(settingInfo);
          } else {
            notAppliedPolicy.push(settingInfo);
          }
        }
      };
      for (const [policyName, settingKey] of policyConfigurations) {
        collectPolicySetting(policyName, settingKey);
      }
      for (const [policyName, settingKeys] of policyReferenceConfigurations) {
        for (const settingKey of settingKeys) {
          collectPolicySetting(policyName, settingKey);
        }
      }
      const getPolicySource = (policyName) => policyValueSourceLabel(policyService.getPolicyValueSource(policyName));
      content += "### Applied Policy\n\n";
      appliedPolicy.sort((a, b) => getPolicySource(a.name).localeCompare(getPolicySource(b.name)) || a.name.localeCompare(b.name));
      if (appliedPolicy.length > 0) {
        content += "| Setting Key | Policy Name | Policy Source | Managed Settings | Default Value | Current Value | Policy Value |\n";
        content += "|-------------|-------------|---------------|------------------|---------------|---------------|-------------|\n";
        for (const setting of appliedPolicy) {
          const defaultValue = JSON.stringify(setting.property.default);
          const currentValue = JSON.stringify(setting.inspection.value);
          const policyValue = JSON.stringify(setting.inspection.policyValue);
          const policySource = getPolicySource(setting.name);
          const managedSettingsKeys = setting.property.policy?.managedSettings ? Object.keys(setting.property.policy.managedSettings).join(", ") : "";
          content += `| ${setting.key} | ${setting.name} | ${policySource} | ${managedSettingsKeys || "*n/a*"} | \`${defaultValue}\` | \`${currentValue}\` | \`${policyValue}\` |
`;
        }
        content += "\n";
      } else {
        content += "*No settings are currently controlled by policies*\n\n";
      }
      content += "###  Non-applied Policy\n\n";
      if (notAppliedPolicy.length > 0) {
        content += "| Setting Key | Policy Name  \n";
        content += "|-------------|-------------|\n";
        for (const setting of notAppliedPolicy) {
          content += `| ${setting.key} | ${setting.name}|
`;
        }
        content += "\n";
      } else {
        content += "*All policy-controllable settings are currently being enforced*\n\n";
      }
    } else {
      content += "*No policy-controlled settings found*\n\n";
    }
    content += "## Authentication Information\n\n";
    try {
      const providerIds = authenticationService.getProviderIds();
      if (providerIds.length > 0) {
        content += "### Authentication Providers\n\n";
        content += "| Provider ID | Sessions | Accounts |\n";
        content += "|-------------|----------|----------|\n";
        for (const providerId of providerIds) {
          try {
            const sessions = await authenticationService.getSessions(providerId);
            const accounts = sessions.map((session) => session.account);
            const uniqueAccounts = Array.from(new Set(accounts.map((account) => account.label)));
            content += `| ${providerId} | ${sessions.length} | ${uniqueAccounts.join(", ") || "None"} |
`;
          } catch (error) {
            content += `| ${providerId} | Error | ${error} |
`;
          }
        }
        content += "\n";
        content += "### Detailed Session Information\n\n";
        for (const providerId of providerIds) {
          try {
            const sessions = await authenticationService.getSessions(providerId);
            if (sessions.length > 0) {
              content += `#### ${providerId}

`;
              content += "| Account | Scopes | Extensions with Access |\n";
              content += "|---------|--------|------------------------|\n";
              for (const session of sessions) {
                const accountName = session.account.label;
                const scopes = session.scopes.join(", ") || "Default";
                try {
                  const allowedExtensions = authenticationAccessService.readAllowedExtensions(providerId, accountName);
                  const extensionNames = allowedExtensions.filter((ext) => ext.allowed !== false).map((ext) => `${ext.name}${ext.trusted ? " (trusted)" : ""}`).join(", ") || "None";
                  content += `| ${accountName} | ${scopes} | ${extensionNames} |
`;
                } catch (error) {
                  content += `| ${accountName} | ${scopes} | Error: ${error} |
`;
                }
              }
              content += "\n";
            }
          } catch (error) {
            content += `#### ${providerId}
*Error retrieving sessions: ${error}*

`;
          }
        }
      } else {
        content += "*No authentication providers found*\n\n";
      }
    } catch (error) {
      content += `*Error retrieving authentication information: ${error}*

`;
    }
    await editorService.openEditor({
      resource: void 0,
      contents: content,
      languageId: "markdown",
      options: { pinned: true }
    });
  }
}
class SyncAccountPolicyAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.syncAccountPolicy",
      title: localize2("syncAccountPolicy", "Sync Account Policy"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const defaultAccountService = accessor.get(IDefaultAccountService);
    const dialogService = accessor.get(IDialogService);
    const logService = accessor.get(ILogService);
    try {
      logService.info("[DefaultAccount] Manually syncing account policy");
      await defaultAccountService.refresh({ forceRefresh: true });
      await dialogService.info(localize("syncAccountPolicy.success", "Account policy has been synced."));
    } catch (error) {
      logService.error("[DefaultAccount] Failed to sync account policy", error);
      await dialogService.error(
        localize("syncAccountPolicy.error", "Failed to sync account policy."),
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
registerAction2(InspectContextKeysAction);
registerAction2(ToggleScreencastModeAction);
registerAction2(LogStorageAction);
registerAction2(LogWorkingCopiesAction);
registerAction2(RemoveLargeStorageEntriesAction);
registerAction2(PolicyDiagnosticsAction);
registerAction2(SyncAccountPolicyAction);
if (!product.commit) {
  registerAction2(StartTrackDisposables);
  registerAction2(SnapshotTrackedDisposables);
  registerAction2(StopTrackDisposables);
}
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
  id: "screencastMode",
  order: 9,
  title: localize("screencastModeConfigurationTitle", "Screencast Mode"),
  type: "object",
  properties: {
    "screencastMode.verticalOffset": {
      type: "number",
      default: 20,
      minimum: 0,
      maximum: 90,
      description: localize("screencastMode.location.verticalPosition", "Controls the vertical offset of the screencast mode overlay from the bottom as a percentage of the workbench height.")
    },
    "screencastMode.fontSize": {
      type: "number",
      default: 56,
      minimum: 20,
      maximum: 100,
      description: localize("screencastMode.fontSize", "Controls the font size (in pixels) of the screencast mode keyboard.")
    },
    "screencastMode.keyboardOptions": {
      type: "object",
      description: localize("screencastMode.keyboardOptions.description", "Options for customizing the keyboard overlay in screencast mode."),
      properties: {
        "showKeys": {
          type: "boolean",
          default: true,
          description: localize("screencastMode.keyboardOptions.showKeys", "Show raw keys.")
        },
        "showKeybindings": {
          type: "boolean",
          default: true,
          description: localize("screencastMode.keyboardOptions.showKeybindings", "Show keyboard shortcuts.")
        },
        "showCommands": {
          type: "boolean",
          default: true,
          description: localize("screencastMode.keyboardOptions.showCommands", "Show command names.")
        },
        "showCommandGroups": {
          type: "boolean",
          default: false,
          description: localize("screencastMode.keyboardOptions.showCommandGroups", "Show command group names, when commands are also shown.")
        },
        "showSingleEditorCursorMoves": {
          type: "boolean",
          default: true,
          description: localize("screencastMode.keyboardOptions.showSingleEditorCursorMoves", "Show single editor cursor move commands.")
        }
      },
      default: {
        "showKeys": true,
        "showKeybindings": true,
        "showCommands": true,
        "showCommandGroups": false,
        "showSingleEditorCursorMoves": true
      },
      additionalProperties: false
    },
    "screencastMode.keyboardOverlayTimeout": {
      type: "number",
      default: 800,
      minimum: 500,
      maximum: 5e3,
      description: localize("screencastMode.keyboardOverlayTimeout", "Controls how long (in milliseconds) the keyboard overlay is shown in screencast mode.")
    },
    "screencastMode.mouseIndicatorColor": {
      type: "string",
      format: "color-hex",
      default: "#FF0000",
      description: localize("screencastMode.mouseIndicatorColor", "Controls the color in hex (#RGB, #RGBA, #RRGGBB or #RRGGBBAA) of the mouse indicator in screencast mode.")
    },
    "screencastMode.mouseIndicatorSize": {
      type: "number",
      default: 20,
      minimum: 20,
      maximum: 100,
      description: localize("screencastMode.mouseIndicatorSize", "Controls the size (in pixels) of the mouse indicator in screencast mode.")
    }
  }
});
