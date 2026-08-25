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
import { toAction } from "../../../../../base/common/actions.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { URI } from "../../../../../base/common/uri.js";
import { DropdownWithPrimaryActionViewItem } from "../../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js";
import { MenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { BrowserViewCommandId } from "../../../../../platform/browserView/common/browserView.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../../platform/configuration/common/configurationRegistry.js";
import { FileChangeType, IFileService } from "../../../../../platform/files/common/files.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { localize } from "../../../../../nls.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../common/contributions.js";
import { workbenchConfigurationNodeBase } from "../../../../common/configuration.js";
import { IBrowserViewWorkbenchService } from "../../common/browserView.js";
import { BrowserEditor, BrowserEditorContribution } from "../browserEditor.js";
const BrowserAutoReloadOnFileChangeSettingId = "workbench.browser.autoReloadOnFileChange";
function getFileUri(url) {
  if (!url) {
    return void 0;
  }
  const uri = URI.parse(url);
  return uri.scheme === Schemas.file ? uri.with({ query: null, fragment: null }) : void 0;
}
const IBrowserAutoReloadService = createDecorator("browserAutoReloadService");
class BrowserAutoReloadWatcher extends Disposable {
  constructor(input, enabled, _fileService) {
    super();
    this._fileService = _fileService;
    this._watcher = this._register(new MutableDisposable());
    this._modelListeners = this._register(new MutableDisposable());
    this._hasPendingChange = false;
    this._enabled = enabled;
    this._register(input.onceModelResolves((model) => this._attachModel(model)));
  }
  setEnabled(enabled) {
    if (this._enabled === enabled) {
      return;
    }
    this._enabled = enabled;
    this._hasPendingChange = false;
    this._updateWatcher();
  }
  _attachModel(model) {
    const listeners = new DisposableStore();
    this._modelListeners.value = listeners;
    this._model = model;
    listeners.add(model.onDidNavigate(() => {
      this._hasPendingChange = false;
      this._updateWatcher();
    }));
    listeners.add(model.onDidChangeVisibility(() => this._reloadPendingChange()));
    listeners.add(model.onWillDispose(() => {
      if (this._model === model) {
        this._model = void 0;
        this._hasPendingChange = false;
        this._watcher.clear();
      }
    }));
    this._updateWatcher();
  }
  _updateWatcher() {
    this._watcher.clear();
    const model = this._model;
    if (!this._enabled || !model) {
      return;
    }
    const uri = getFileUri(model.url);
    if (!uri) {
      return;
    }
    const store = new DisposableStore();
    const scheduler = store.add(new RunOnceScheduler(() => {
      this._hasPendingChange = true;
      this._reloadPendingChange();
    }, 300));
    const watcher = store.add(this._fileService.createWatcher(uri, { recursive: false, excludes: [] }));
    store.add(watcher.onDidChange((event) => {
      if (event.contains(uri, FileChangeType.UPDATED) || event.contains(uri, FileChangeType.ADDED)) {
        scheduler.schedule();
      }
    }));
    this._watcher.value = store;
  }
  _reloadPendingChange() {
    if (!this._enabled || !this._hasPendingChange || !this._model?.visible) {
      return;
    }
    this._hasPendingChange = false;
    this._model.reload().catch(onUnexpectedError);
  }
}
let BrowserAutoReloadService = class extends Disposable {
  constructor(_browserViewWorkbenchService, _configurationService, _fileService) {
    super();
    this._browserViewWorkbenchService = _browserViewWorkbenchService;
    this._configurationService = _configurationService;
    this._fileService = _fileService;
    this._onDidChangeState = this._register(new Emitter());
    this.onDidChangeState = this._onDidChangeState.event;
    this._watchers = /* @__PURE__ */ new Map();
    this._overrides = /* @__PURE__ */ new Map();
    this._register(this._browserViewWorkbenchService.onDidChangeBrowserViews(() => this._updateBrowserViews()));
    this._register(this._configurationService.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(BrowserAutoReloadOnFileChangeSettingId)) {
        this._updateDefault();
      }
    }));
    this._updateBrowserViews();
  }
  isEnabled(browserId) {
    return this._overrides.get(browserId) ?? this._configurationService.getValue(BrowserAutoReloadOnFileChangeSettingId);
  }
  setEnabled(browserId, enabled) {
    if (this.isEnabled(browserId) === enabled) {
      return;
    }
    this._overrides.set(browserId, enabled);
    this._watchers.get(browserId)?.watcher.setEnabled(enabled);
    this._onDidChangeState.fire({ browserId, enabled });
  }
  _updateBrowserViews() {
    const browserViews = this._browserViewWorkbenchService.getKnownBrowserViews();
    for (const [browserId, entry] of this._watchers) {
      const input = browserViews.get(browserId);
      if (input !== entry.input) {
        entry.watcher.dispose();
        this._watchers.delete(browserId);
        if (!input) {
          this._overrides.delete(browserId);
        }
      }
    }
    for (const [browserId, input] of browserViews) {
      if (!this._watchers.has(browserId)) {
        const watcher = new BrowserAutoReloadWatcher(input, this.isEnabled(browserId), this._fileService);
        this._watchers.set(browserId, { input, watcher });
      }
    }
  }
  _updateDefault() {
    for (const [browserId, entry] of this._watchers) {
      if (!this._overrides.has(browserId)) {
        const enabled = this.isEnabled(browserId);
        entry.watcher.setEnabled(enabled);
        this._onDidChangeState.fire({ browserId, enabled });
      }
    }
  }
  dispose() {
    for (const { watcher } of this._watchers.values()) {
      watcher.dispose();
    }
    this._watchers.clear();
    super.dispose();
  }
};
BrowserAutoReloadService = __decorateClass([
  __decorateParam(0, IBrowserViewWorkbenchService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IFileService)
], BrowserAutoReloadService);
let BrowserAutoReloadWorkbenchContribution = class {
  static {
    this.ID = "workbench.contrib.browserAutoReload";
  }
  constructor(_browserAutoReloadService) {
  }
};
BrowserAutoReloadWorkbenchContribution = __decorateClass([
  __decorateParam(0, IBrowserAutoReloadService)
], BrowserAutoReloadWorkbenchContribution);
let BrowserEditorAutoReloadContribution = class extends BrowserEditorContribution {
  constructor(editor, _browserAutoReloadService) {
    super(editor);
    this._browserAutoReloadService = _browserAutoReloadService;
    this._onDidChangeActionViewItems = this._register(new Emitter());
    this.onDidChangeActionViewItems = this._onDidChangeActionViewItems.event;
    this._actionViewItemsUpdateScheduler = this._register(new RunOnceScheduler(() => this._onDidChangeActionViewItems.fire(), 0));
    this._register(this._browserAutoReloadService.onDidChangeState((event) => {
      if (event.browserId === this._model?.id) {
        this._actionViewItemsUpdateScheduler.schedule();
      }
    }));
  }
  get isLiveReloadEnabled() {
    return this.isFile && this._browserAutoReloadService.isEnabled(this._model.id);
  }
  get isFile() {
    return !!this._model && !!getFileUri(this._model.url);
  }
  getActionViewItem(action, options, instantiationService) {
    if (action.id !== BrowserViewCommandId.Reload || !(action instanceof MenuItemAction) || !this.isFile) {
      return void 0;
    }
    const primaryAction = this.isLiveReloadEnabled ? instantiationService.createInstance(
      MenuItemAction,
      {
        ...action.item,
        icon: Codicon.sync,
        title: localize("browser.reloadAutomaticRefreshEnabled", "Reload (Automatic Refresh Enabled)")
      },
      action.alt?.item,
      { shouldForwardArgs: true },
      action.hideActions,
      action.menuKeybinding
    ) : action;
    return instantiationService.createInstance(
      DropdownWithPrimaryActionViewItem,
      primaryAction,
      toAction({
        id: "workbench.browser.reloadMenu",
        label: localize("browser.reloadMenu", "More Reload Actions"),
        run: () => {
        }
      }),
      this._getLiveReloadMenuActions(),
      "",
      { hoverDelegate: options.hoverDelegate }
    );
  }
  onModelAttached(model, store) {
    this._model = model;
    this._onDidChangeActionViewItems.fire();
    store.add(model.onDidNavigate(() => {
      this._onDidChangeActionViewItems.fire();
    }));
  }
  onModelDetached() {
    this._model = void 0;
    this._onDidChangeActionViewItems.fire();
  }
  _getLiveReloadMenuActions() {
    const contribution = this;
    const toggleAction = {
      id: "workbench.browser.toggleAutoReload",
      label: localize("browser.refreshAutomatically", "Refresh Automatically"),
      tooltip: "",
      class: void 0,
      get enabled() {
        return contribution.isFile;
      },
      get checked() {
        return contribution.isLiveReloadEnabled;
      },
      run: () => {
        const model = this._model;
        if (model) {
          this._browserAutoReloadService.setEnabled(model.id, !this.isLiveReloadEnabled);
        }
      }
    };
    return [toggleAction];
  }
};
BrowserEditorAutoReloadContribution = __decorateClass([
  __decorateParam(1, IBrowserAutoReloadService)
], BrowserEditorAutoReloadContribution);
registerSingleton(IBrowserAutoReloadService, BrowserAutoReloadService, InstantiationType.Delayed);
registerWorkbenchContribution2(BrowserAutoReloadWorkbenchContribution.ID, BrowserAutoReloadWorkbenchContribution, WorkbenchPhase.AfterRestored);
BrowserEditor.registerContribution(BrowserEditorAutoReloadContribution);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...workbenchConfigurationNodeBase,
  properties: {
    [BrowserAutoReloadOnFileChangeSettingId]: {
      type: "boolean",
      default: true,
      markdownDescription: localize(
        { comment: ["This is the description for a setting."], key: "browser.autoReloadOnFileChange" },
        "Controls whether the Integrated Browser automatically reloads by default when displaying local `file://` resources that change on disk."
      )
    }
  }
});
export {
  BrowserAutoReloadService,
  BrowserAutoReloadWatcher
};
