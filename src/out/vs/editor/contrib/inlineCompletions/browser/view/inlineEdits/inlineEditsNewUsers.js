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
import { timeout } from "../../../../../../base/common/async.js";
import { BugIndicatingError } from "../../../../../../base/common/errors.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue, runOnChange, runOnChangeWithCancellationToken } from "../../../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
var UserKind = /* @__PURE__ */ ((UserKind2) => {
  UserKind2["FirstTime"] = "firstTime";
  UserKind2["SecondTime"] = "secondTime";
  UserKind2["Active"] = "active";
  return UserKind2;
})(UserKind || {});
let InlineEditsOnboardingExperience = class extends Disposable {
  constructor(_model, _indicator, _collapsedView, _storageService, _configurationService) {
    super();
    this._model = _model;
    this._indicator = _indicator;
    this._collapsedView = _collapsedView;
    this._storageService = _storageService;
    this._configurationService = _configurationService;
    this._disposables = this._register(new MutableDisposable());
    this._setupDone = observableValue({ name: "setupDone" }, false);
    this._activeCompletionId = derived((reader) => {
      const model = this._model.read(reader);
      if (!model) {
        return void 0;
      }
      if (!this._setupDone.read(reader)) {
        return void 0;
      }
      const indicator = this._indicator.read(reader);
      if (!indicator || !indicator.isVisible.read(reader)) {
        return void 0;
      }
      return model.inlineEdit.inlineCompletion.identity.id;
    });
    this._register(this._initializeDebugSetting());
    this._disposables.value = this.setupNewUserExperience();
    this._setupDone.set(true, void 0);
  }
  setupNewUserExperience() {
    if (this.getNewUserType() === "active" /* Active */) {
      return void 0;
    }
    const disposableStore = new DisposableStore();
    let userHasHoveredOverIcon = false;
    let inlineEditHasBeenAccepted = false;
    let firstTimeUserAnimationCount = 0;
    let secondTimeUserAnimationCount = 0;
    disposableStore.add(runOnChangeWithCancellationToken(this._activeCompletionId, async (id, _, __, token) => {
      if (id === void 0) {
        return;
      }
      let userType = this.getNewUserType();
      switch (userType) {
        case "firstTime" /* FirstTime */: {
          if (firstTimeUserAnimationCount++ >= 5 || userHasHoveredOverIcon) {
            userType = "secondTime" /* SecondTime */;
            this.setNewUserType(userType);
          }
          break;
        }
        case "secondTime" /* SecondTime */: {
          if (secondTimeUserAnimationCount++ >= 3 && inlineEditHasBeenAccepted) {
            userType = "active" /* Active */;
            this.setNewUserType(userType);
          }
          break;
        }
      }
      switch (userType) {
        case "firstTime" /* FirstTime */: {
          for (let i = 0; i < 3 && !token.isCancellationRequested; i++) {
            await this._indicator.get()?.triggerAnimation();
            await timeout(500);
          }
          break;
        }
        case "secondTime" /* SecondTime */: {
          this._indicator.get()?.triggerAnimation();
          break;
        }
      }
    }));
    disposableStore.add(autorun((reader) => {
      if (this._collapsedView.isVisible.read(reader)) {
        if (this.getNewUserType() !== "active" /* Active */) {
          this._collapsedView.triggerAnimation();
        }
      }
    }));
    disposableStore.add(autorun((reader) => {
      const indicator = this._indicator.read(reader);
      if (!indicator) {
        return;
      }
      reader.store.add(runOnChange(indicator.isHoveredOverIcon, async (isHovered) => {
        if (isHovered) {
          userHasHoveredOverIcon = true;
        }
      }));
    }));
    disposableStore.add(autorun((reader) => {
      const model = this._model.read(reader);
      if (!model) {
        return;
      }
      reader.store.add(model.onDidAccept(() => {
        inlineEditHasBeenAccepted = true;
      }));
    }));
    return disposableStore;
  }
  getNewUserType() {
    return this._storageService.get("inlineEditsGutterIndicatorUserKind", StorageScope.APPLICATION, "firstTime" /* FirstTime */);
  }
  setNewUserType(value) {
    switch (value) {
      case "firstTime" /* FirstTime */:
        throw new BugIndicatingError("UserKind should not be set to first time");
      case "secondTime" /* SecondTime */:
        break;
      case "active" /* Active */:
        this._disposables.clear();
        break;
    }
    this._storageService.store("inlineEditsGutterIndicatorUserKind", value, StorageScope.APPLICATION, StorageTarget.USER);
  }
  _initializeDebugSetting() {
    const hiddenDebugSetting = "editor.inlineSuggest.edits.resetNewUserExperience";
    if (this._configurationService.getValue(hiddenDebugSetting)) {
      this._storageService.remove("inlineEditsGutterIndicatorUserKind", StorageScope.APPLICATION);
    }
    const disposable = this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(hiddenDebugSetting) && this._configurationService.getValue(hiddenDebugSetting)) {
        this._storageService.remove("inlineEditsGutterIndicatorUserKind", StorageScope.APPLICATION);
        this._disposables.value = this.setupNewUserExperience();
      }
    });
    return disposable;
  }
};
InlineEditsOnboardingExperience = __decorateClass([
  __decorateParam(3, IStorageService),
  __decorateParam(4, IConfigurationService)
], InlineEditsOnboardingExperience);
export {
  InlineEditsOnboardingExperience
};
