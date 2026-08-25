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
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { KeybindingLabel } from "../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { OS } from "../../../../base/common/platform.js";
import { ContentWidgetPositionPreference } from "../../../../editor/browser/editorBrowser.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../editor/common/core/position.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { ReplEditorSettings } from "./interactiveCommon.js";
let ReplInputHintContentWidget = class extends Disposable {
  constructor(editor, configurationService, keybindingService) {
    super();
    this.editor = editor;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.ariaLabel = "";
    this._register(this.editor.onDidChangeConfiguration((e) => {
      if (this.domNode && e.hasChanged(EditorOption.fontInfo)) {
        this.editor.applyFontInfo(this.domNode);
      }
    }));
    const onDidFocusEditorText = Event.debounce(this.editor.onDidFocusEditorText, () => void 0, 500);
    this._register(onDidFocusEditorText(() => {
      if (this.editor.hasTextFocus() && this.ariaLabel && configurationService.getValue(AccessibilityVerbositySettingId.ReplEditor)) {
        status(this.ariaLabel);
      }
    }));
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ReplEditorSettings.executeWithShiftEnter)) {
        this.setHint();
      }
    }));
    this.editor.addContentWidget(this);
  }
  static {
    this.ID = "replInput.widget.emptyHint";
  }
  getId() {
    return ReplInputHintContentWidget.ID;
  }
  getPosition() {
    return {
      position: { lineNumber: 1, column: 1 },
      preference: [ContentWidgetPositionPreference.EXACT]
    };
  }
  getDomNode() {
    if (!this.domNode) {
      this.domNode = dom.$(".empty-editor-hint");
      this.domNode.style.width = "max-content";
      this.domNode.style.paddingLeft = "4px";
      this.setHint();
      this._register(dom.addDisposableListener(this.domNode, "click", () => {
        this.editor.focus();
      }));
      this.editor.applyFontInfo(this.domNode);
      const lineHeight = this.editor.getLineHeightForPosition(new Position(1, 1));
      this.domNode.style.lineHeight = lineHeight + "px";
    }
    return this.domNode;
  }
  setHint() {
    if (!this.domNode) {
      return;
    }
    while (this.domNode.firstChild) {
      this.domNode.removeChild(this.domNode.firstChild);
    }
    const hintElement = dom.$("div.empty-hint-text");
    hintElement.style.cursor = "text";
    hintElement.style.whiteSpace = "nowrap";
    const keybinding = this.getKeybinding();
    const keybindingHintLabel = keybinding?.getLabel();
    if (keybinding && keybindingHintLabel) {
      const actionPart = localize("emptyHintText", "Press {0} to execute. ", keybindingHintLabel);
      const [before, after] = actionPart.split(keybindingHintLabel).map((fragment) => {
        const hintPart = dom.$("span", void 0, fragment);
        hintPart.style.fontStyle = "italic";
        return hintPart;
      });
      hintElement.appendChild(before);
      if (this.label) {
        this.label.dispose();
      }
      this.label = this._register(new KeybindingLabel(hintElement, OS));
      this.label.set(keybinding);
      this.label.element.style.width = "min-content";
      this.label.element.style.display = "inline";
      hintElement.appendChild(after);
      this.domNode.append(hintElement);
      const helpKeybinding = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
      const helpInfo = helpKeybinding ? localize("ReplInputAriaLabelHelp", "Use {0} for accessibility help. ", helpKeybinding) : localize("ReplInputAriaLabelHelpNoKb", "Run the Open Accessibility Help command for more information. ");
      this.ariaLabel = actionPart.concat(helpInfo, localize("disableHint", " Toggle {0} in settings to disable this hint.", AccessibilityVerbositySettingId.ReplEditor));
    }
  }
  getKeybinding() {
    const keybindings = this.keybindingService.lookupKeybindings("interactive.execute");
    const shiftEnterConfig = this.configurationService.getValue(ReplEditorSettings.executeWithShiftEnter);
    const hasEnterChord = (kb, modifier = "") => {
      const chords = kb.getDispatchChords();
      const chord = modifier + "Enter";
      const chordAlt = modifier + "[Enter]";
      return chords.length === 1 && (chords[0] === chord || chords[0] === chordAlt);
    };
    if (shiftEnterConfig) {
      const keybinding = keybindings.find((kb) => hasEnterChord(kb, "shift+"));
      if (keybinding) {
        return keybinding;
      }
    } else {
      let keybinding = keybindings.find((kb) => hasEnterChord(kb));
      if (keybinding) {
        return keybinding;
      }
      keybinding = this.keybindingService.lookupKeybindings("python.execInREPLEnter").find((kb) => hasEnterChord(kb));
      if (keybinding) {
        return keybinding;
      }
    }
    return keybindings?.[0];
  }
  dispose() {
    super.dispose();
    this.editor.removeContentWidget(this);
    this.label?.dispose();
  }
};
ReplInputHintContentWidget = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IKeybindingService)
], ReplInputHintContentWidget);
export {
  ReplInputHintContentWidget
};
