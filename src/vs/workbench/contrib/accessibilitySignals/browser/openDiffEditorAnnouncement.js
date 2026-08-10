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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { Event } from "../../../../base/common/event.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
let DiffEditorActiveAnnouncementContribution = class extends Disposable {
  constructor(_editorService, _accessibilityService, _configurationService) {
    super();
    this._editorService = _editorService;
    this._accessibilityService = _accessibilityService;
    this._configurationService = _configurationService;
    this._register(Event.runAndSubscribe(_accessibilityService.onDidChangeScreenReaderOptimized, () => this._updateListener()));
    this._register(_configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AccessibilityVerbositySettingId.DiffEditorActive)) {
        this._updateListener();
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.diffEditorActiveAnnouncement";
  }
  _updateListener() {
    const announcementEnabled = this._configurationService.getValue(AccessibilityVerbositySettingId.DiffEditorActive);
    const screenReaderOptimized = this._accessibilityService.isScreenReaderOptimized();
    if (!announcementEnabled || !screenReaderOptimized) {
      this._onDidActiveEditorChangeListener?.dispose();
      this._onDidActiveEditorChangeListener = void 0;
      return;
    }
    if (this._onDidActiveEditorChangeListener) {
      return;
    }
    this._onDidActiveEditorChangeListener = this._register(this._editorService.onDidActiveEditorChange(() => {
      if (isDiffEditor(this._editorService.activeTextEditorControl)) {
        this._accessibilityService.alert(localize("openDiffEditorAnnouncement", "Diff editor"));
      }
    }));
  }
};
DiffEditorActiveAnnouncementContribution = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IAccessibilityService),
  __decorateParam(2, IConfigurationService)
], DiffEditorActiveAnnouncementContribution);
export {
  DiffEditorActiveAnnouncementContribution
};
