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
import { Emitter } from "../../../../base/common/event.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { EditorsOrder } from "../../../common/editor.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { IEditorService } from "../../editor/common/editorService.js";
const IWorkingCopyEditorService = createDecorator("workingCopyEditorService");
let WorkingCopyEditorService = class extends Disposable {
  constructor(editorService) {
    super();
    this.editorService = editorService;
    this._onDidRegisterHandler = this._register(new Emitter());
    this.onDidRegisterHandler = this._onDidRegisterHandler.event;
    this.handlers = /* @__PURE__ */ new Set();
  }
  registerHandler(handler) {
    this.handlers.add(handler);
    this._onDidRegisterHandler.fire(handler);
    return toDisposable(() => this.handlers.delete(handler));
  }
  findEditor(workingCopy) {
    for (const editorIdentifier of this.editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
      if (this.isOpen(workingCopy, editorIdentifier.editor)) {
        return editorIdentifier;
      }
    }
    return void 0;
  }
  isOpen(workingCopy, editor) {
    for (const handler of this.handlers) {
      if (handler.isOpen(workingCopy, editor)) {
        return true;
      }
    }
    return false;
  }
};
WorkingCopyEditorService = __decorateClass([
  __decorateParam(0, IEditorService)
], WorkingCopyEditorService);
registerSingleton(IWorkingCopyEditorService, WorkingCopyEditorService, InstantiationType.Delayed);
export {
  IWorkingCopyEditorService,
  WorkingCopyEditorService
};
