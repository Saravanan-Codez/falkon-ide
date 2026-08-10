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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Range } from "../../../../editor/common/core/range.js";
import { registerEditorContribution, EditorContributionInstantiation } from "../../../../editor/browser/editorExtensions.js";
import { SnippetController2 } from "../../../../editor/contrib/snippet/browser/snippetController2.js";
import { SmartSnippetInserter } from "../common/smartSnippetInserter.js";
import { DefineKeybindingOverlayWidget } from "./keybindingWidgets.js";
import { parseTree } from "../../../../base/common/json.js";
import { WindowsNativeResolvedKeybinding } from "../../../services/keybinding/common/windowsKeyboardMapper.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import { overviewRulerInfo, overviewRulerError } from "../../../../editor/common/core/editorColorRegistry.js";
import { TrackedRangeStickiness, OverviewRulerLane } from "../../../../editor/common/model.js";
import { KeybindingParser } from "../../../../base/common/keybindingParser.js";
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { DEFINE_KEYBINDING_EDITOR_CONTRIB_ID } from "../../../services/preferences/common/preferences.js";
const NLS_KB_LAYOUT_ERROR_MESSAGE = nls.localize("defineKeybinding.kbLayoutErrorMessage", "You won't be able to produce this key combination under your current keyboard layout.");
let DefineKeybindingEditorContribution = class extends Disposable {
  constructor(_editor, _instantiationService, _userDataProfileService) {
    super();
    this._editor = _editor;
    this._instantiationService = _instantiationService;
    this._userDataProfileService = _userDataProfileService;
    this._keybindingDecorationRenderer = this._register(new MutableDisposable());
    this._defineWidget = this._register(this._instantiationService.createInstance(DefineKeybindingOverlayWidget, this._editor));
    this._register(this._editor.onDidChangeModel((e) => this._update()));
    this._update();
  }
  _update() {
    this._keybindingDecorationRenderer.value = isInterestingEditorModel(this._editor, this._userDataProfileService) ? this._instantiationService.createInstance(KeybindingEditorDecorationsRenderer, this._editor) : void 0;
  }
  showDefineKeybindingWidget() {
    if (isInterestingEditorModel(this._editor, this._userDataProfileService)) {
      this._defineWidget.start().then((keybinding) => this._onAccepted(keybinding));
    }
  }
  _onAccepted(keybinding) {
    this._editor.focus();
    if (keybinding && this._editor.hasModel()) {
      const regexp = new RegExp(/\\/g);
      const backslash = regexp.test(keybinding);
      if (backslash) {
        keybinding = keybinding.slice(0, -1) + "\\\\";
      }
      let snippetText = [
        "{",
        '	"key": ' + JSON.stringify(keybinding) + ",",
        '	"command": "${1:commandId}",',
        '	"when": "${2:editorTextFocus}"',
        "}$0"
      ].join("\n");
      const smartInsertInfo = SmartSnippetInserter.insertSnippet(this._editor.getModel(), this._editor.getPosition());
      snippetText = smartInsertInfo.prepend + snippetText + smartInsertInfo.append;
      this._editor.setPosition(smartInsertInfo.position);
      SnippetController2.get(this._editor)?.insert(snippetText, { overwriteBefore: 0, overwriteAfter: 0 });
    }
  }
};
DefineKeybindingEditorContribution = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IUserDataProfileService)
], DefineKeybindingEditorContribution);
let KeybindingEditorDecorationsRenderer = class extends Disposable {
  constructor(_editor, _keybindingService) {
    super();
    this._editor = _editor;
    this._keybindingService = _keybindingService;
    this._dec = this._editor.createDecorationsCollection();
    this._updateDecorations = this._register(new RunOnceScheduler(() => this._updateDecorationsNow(), 500));
    const model = assertReturnsDefined(this._editor.getModel());
    this._register(model.onDidChangeContent(() => this._updateDecorations.schedule()));
    this._register(this._keybindingService.onDidUpdateKeybindings(() => this._updateDecorations.schedule()));
    this._register({
      dispose: () => {
        this._dec.clear();
        this._updateDecorations.cancel();
      }
    });
    this._updateDecorations.schedule();
  }
  _updateDecorationsNow() {
    const model = assertReturnsDefined(this._editor.getModel());
    const newDecorations = [];
    const root = parseTree(model.getValue());
    if (root && Array.isArray(root.children)) {
      for (let i = 0, len = root.children.length; i < len; i++) {
        const entry = root.children[i];
        const dec = this._getDecorationForEntry(model, entry);
        if (dec !== null) {
          newDecorations.push(dec);
        }
      }
    }
    this._dec.set(newDecorations);
  }
  _getDecorationForEntry(model, entry) {
    if (!Array.isArray(entry.children)) {
      return null;
    }
    for (let i = 0, len = entry.children.length; i < len; i++) {
      const prop = entry.children[i];
      if (prop.type !== "property") {
        continue;
      }
      if (!Array.isArray(prop.children) || prop.children.length !== 2) {
        continue;
      }
      const key = prop.children[0];
      if (key.value !== "key") {
        continue;
      }
      const value = prop.children[1];
      if (value.type !== "string") {
        continue;
      }
      const resolvedKeybindings = this._keybindingService.resolveUserBinding(value.value);
      if (resolvedKeybindings.length === 0) {
        return this._createDecoration(true, null, null, model, value);
      }
      const resolvedKeybinding = resolvedKeybindings[0];
      let usLabel = null;
      if (resolvedKeybinding instanceof WindowsNativeResolvedKeybinding) {
        usLabel = resolvedKeybinding.getUSLabel();
      }
      if (!resolvedKeybinding.isWYSIWYG()) {
        const uiLabel = resolvedKeybinding.getLabel();
        if (typeof uiLabel === "string" && value.value.toLowerCase() === uiLabel.toLowerCase()) {
          return null;
        }
        return this._createDecoration(false, resolvedKeybinding.getLabel(), usLabel, model, value);
      }
      if (/abnt_|oem_/.test(value.value)) {
        return this._createDecoration(false, resolvedKeybinding.getLabel(), usLabel, model, value);
      }
      const expectedUserSettingsLabel = resolvedKeybinding.getUserSettingsLabel();
      if (typeof expectedUserSettingsLabel === "string" && !KeybindingEditorDecorationsRenderer._userSettingsFuzzyEquals(value.value, expectedUserSettingsLabel)) {
        return this._createDecoration(false, resolvedKeybinding.getLabel(), usLabel, model, value);
      }
      return null;
    }
    return null;
  }
  static _userSettingsFuzzyEquals(a, b) {
    a = a.trim().toLowerCase();
    b = b.trim().toLowerCase();
    if (a === b) {
      return true;
    }
    const aKeybinding = KeybindingParser.parseKeybinding(a);
    const bKeybinding = KeybindingParser.parseKeybinding(b);
    if (aKeybinding === null && bKeybinding === null) {
      return true;
    }
    if (!aKeybinding || !bKeybinding) {
      return false;
    }
    return aKeybinding.equals(bKeybinding);
  }
  _createDecoration(isError, uiLabel, usLabel, model, keyNode) {
    let msg;
    let className;
    let overviewRulerColor;
    if (isError) {
      msg = new MarkdownString().appendText(NLS_KB_LAYOUT_ERROR_MESSAGE);
      className = "keybindingError";
      overviewRulerColor = themeColorFromId(overviewRulerError);
    } else {
      if (usLabel && uiLabel !== usLabel) {
        msg = new MarkdownString(
          nls.localize({
            key: "defineKeybinding.kbLayoutLocalAndUSMessage",
            comment: [
              "Please translate maintaining the stars (*) around the placeholders such that they will be rendered in bold.",
              "The placeholders will contain a keyboard combination e.g. Ctrl+Shift+/"
            ]
          }, "**{0}** for your current keyboard layout (**{1}** for US standard).", uiLabel, usLabel)
        );
      } else {
        msg = new MarkdownString(
          nls.localize({
            key: "defineKeybinding.kbLayoutLocalMessage",
            comment: [
              "Please translate maintaining the stars (*) around the placeholder such that it will be rendered in bold.",
              "The placeholder will contain a keyboard combination e.g. Ctrl+Shift+/"
            ]
          }, "**{0}** for your current keyboard layout.", uiLabel)
        );
      }
      className = "keybindingInfo";
      overviewRulerColor = themeColorFromId(overviewRulerInfo);
    }
    const startPosition = model.getPositionAt(keyNode.offset);
    const endPosition = model.getPositionAt(keyNode.offset + keyNode.length);
    const range = new Range(
      startPosition.lineNumber,
      startPosition.column,
      endPosition.lineNumber,
      endPosition.column
    );
    return {
      range,
      options: {
        description: "keybindings-widget",
        stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        className,
        hoverMessage: msg,
        overviewRuler: {
          color: overviewRulerColor,
          position: OverviewRulerLane.Right
        }
      }
    };
  }
};
KeybindingEditorDecorationsRenderer = __decorateClass([
  __decorateParam(1, IKeybindingService)
], KeybindingEditorDecorationsRenderer);
function isInterestingEditorModel(editor, userDataProfileService) {
  const model = editor.getModel();
  if (!model) {
    return false;
  }
  return isEqual(model.uri, userDataProfileService.currentProfile.keybindingsResource);
}
registerEditorContribution(DEFINE_KEYBINDING_EDITOR_CONTRIB_ID, DefineKeybindingEditorContribution, EditorContributionInstantiation.AfterFirstRender);
export {
  KeybindingEditorDecorationsRenderer
};
