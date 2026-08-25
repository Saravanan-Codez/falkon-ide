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
import { disposableWindowInterval } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { randomPort } from "../../../../base/common/ports.js";
import * as nls from "../../../../nls.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ExtensionIdentifierMap } from "../../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { RuntimeExtensionsInput } from "../common/runtimeExtensionsInput.js";
import { ProfileSessionState } from "./runtimeExtensionsEditor.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ExtensionHostKind } from "../../../services/extensions/common/extensionHostKind.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ExtensionHostProfiler } from "../../../services/extensions/electron-browser/extensionHostProfiler.js";
import { IStatusbarService, StatusbarAlignment } from "../../../services/statusbar/browser/statusbar.js";
let ExtensionHostProfileService = class extends Disposable {
  constructor(_extensionService, _editorService, _instantiationService, _nativeHostService, _dialogService, _statusbarService, _productService) {
    super();
    this._extensionService = _extensionService;
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._nativeHostService = _nativeHostService;
    this._dialogService = _dialogService;
    this._statusbarService = _statusbarService;
    this._productService = _productService;
    this._onDidChangeState = this._register(new Emitter());
    this.onDidChangeState = this._onDidChangeState.event;
    this._onDidChangeLastProfile = this._register(new Emitter());
    this.onDidChangeLastProfile = this._onDidChangeLastProfile.event;
    this._unresponsiveProfiles = new ExtensionIdentifierMap();
    this._state = ProfileSessionState.None;
    this.profilingStatusBarIndicatorLabelUpdater = this._register(new MutableDisposable());
    this._profile = null;
    this._profileSession = null;
    this._setState(ProfileSessionState.None);
    CommandsRegistry.registerCommand("workbench.action.extensionHostProfiler.stop", () => {
      this.stopProfiling();
      this._editorService.openEditor(RuntimeExtensionsInput.instance, { pinned: true });
    });
  }
  get state() {
    return this._state;
  }
  get lastProfile() {
    return this._profile;
  }
  _setState(state) {
    if (this._state === state) {
      return;
    }
    this._state = state;
    if (this._state === ProfileSessionState.Running) {
      this.updateProfilingStatusBarIndicator(true);
    } else if (this._state === ProfileSessionState.Stopping) {
      this.updateProfilingStatusBarIndicator(false);
    }
    this._onDidChangeState.fire(void 0);
  }
  updateProfilingStatusBarIndicator(visible) {
    this.profilingStatusBarIndicatorLabelUpdater.clear();
    if (visible) {
      const indicator = {
        name: nls.localize("status.profiler", "Extension Profiler"),
        text: nls.localize("profilingExtensionHost", "Profiling Extension Host"),
        showProgress: true,
        ariaLabel: nls.localize("profilingExtensionHost", "Profiling Extension Host"),
        tooltip: nls.localize("selectAndStartDebug", "Click to stop profiling."),
        command: "workbench.action.extensionHostProfiler.stop"
      };
      const timeStarted = Date.now();
      const handle = disposableWindowInterval(mainWindow, () => {
        this.profilingStatusBarIndicator?.update({ ...indicator, text: nls.localize("profilingExtensionHostTime", "Profiling Extension Host ({0} sec)", Math.round(((/* @__PURE__ */ new Date()).getTime() - timeStarted) / 1e3)) });
      }, 1e3);
      this.profilingStatusBarIndicatorLabelUpdater.value = handle;
      if (!this.profilingStatusBarIndicator) {
        this.profilingStatusBarIndicator = this._statusbarService.addEntry(indicator, "status.profiler", StatusbarAlignment.RIGHT);
      } else {
        this.profilingStatusBarIndicator.update(indicator);
      }
    } else {
      if (this.profilingStatusBarIndicator) {
        this.profilingStatusBarIndicator.dispose();
        this.profilingStatusBarIndicator = void 0;
      }
    }
  }
  async startProfiling() {
    if (this._state !== ProfileSessionState.None) {
      return null;
    }
    const inspectPorts = await this._extensionService.getInspectPorts(ExtensionHostKind.LocalProcess, true);
    if (inspectPorts.length === 0) {
      return this._dialogService.confirm({
        type: "info",
        message: nls.localize("restart1", "Profile Extensions"),
        detail: nls.localize("restart2", "In order to profile extensions a restart is required. Do you want to restart '{0}' now?", this._productService.nameLong),
        primaryButton: nls.localize({ key: "restart3", comment: ["&& denotes a mnemonic"] }, "&&Restart")
      }).then((res) => {
        if (res.confirmed) {
          this._nativeHostService.relaunch({ addArgs: [`--inspect-extensions=${randomPort()}`] });
        }
      });
    }
    if (inspectPorts.length > 1) {
      console.warn(`There are multiple extension hosts available for profiling. Picking the first one...`);
    }
    this._setState(ProfileSessionState.Starting);
    return this._instantiationService.createInstance(ExtensionHostProfiler, inspectPorts[0].host, inspectPorts[0].port).start().then((value) => {
      this._profileSession = value;
      this._setState(ProfileSessionState.Running);
    }, (err) => {
      onUnexpectedError(err);
      this._setState(ProfileSessionState.None);
    });
  }
  stopProfiling() {
    if (this._state !== ProfileSessionState.Running || !this._profileSession) {
      return;
    }
    this._setState(ProfileSessionState.Stopping);
    this._profileSession.stop().then((result) => {
      this._setLastProfile(result);
      this._setState(ProfileSessionState.None);
    }, (err) => {
      onUnexpectedError(err);
      this._setState(ProfileSessionState.None);
    });
    this._profileSession = null;
  }
  _setLastProfile(profile) {
    this._profile = profile;
    this.lastProfileSavedTo = void 0;
    this._onDidChangeLastProfile.fire(void 0);
  }
  getUnresponsiveProfile(extensionId) {
    return this._unresponsiveProfiles.get(extensionId);
  }
  setUnresponsiveProfile(extensionId, profile) {
    this._unresponsiveProfiles.set(extensionId, profile);
    this._setLastProfile(profile);
  }
};
ExtensionHostProfileService = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, INativeHostService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, IStatusbarService),
  __decorateParam(6, IProductService)
], ExtensionHostProfileService);
export {
  ExtensionHostProfileService
};
