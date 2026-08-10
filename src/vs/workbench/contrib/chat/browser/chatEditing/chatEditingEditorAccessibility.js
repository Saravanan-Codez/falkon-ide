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
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun, observableFromEvent } from "../../../../../base/common/observable.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IChatEditingService } from "../../common/editing/chatEditingService.js";
let ChatEditingEditorAccessibility = class {
  constructor(chatEditingService, editorService, accessibilityService) {
    this._store = new DisposableStore();
    const activeUri = observableFromEvent(this, editorService.onDidActiveEditorChange, () => editorService.activeEditorPane?.input?.resource);
    this._store.add(autorun((r) => {
      const editor = activeUri.read(r);
      if (!editor) {
        return;
      }
      const entry = chatEditingService.editingSessionsObs.read(r).find((session) => session.readEntry(editor, r));
      if (entry) {
        accessibilityService.playSignal(AccessibilitySignal.chatEditModifiedFile);
      }
    }));
  }
  static {
    this.ID = "chat.edits.accessibilty";
  }
  dispose() {
    this._store.dispose();
  }
};
ChatEditingEditorAccessibility = __decorateClass([
  __decorateParam(0, IChatEditingService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IAccessibilitySignalService)
], ChatEditingEditorAccessibility);
export {
  ChatEditingEditorAccessibility
};
