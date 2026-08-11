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
import { IOutlineService } from "../../../services/outline/browser/outline.js";
import { ChatOutline } from "./chatOutline.js";
import { ChatEditor } from "./widgetHosts/editor/chatEditor.js";
let ChatOutlineCreator = class {
  static {
    this.ID = "chat.chatOutlineCreator";
  }
  constructor(outlineService) {
    const reg = outlineService.registerOutlineCreator(this);
    this.dispose = () => reg.dispose();
  }
  matches(candidate) {
    return candidate instanceof ChatEditor;
  }
  async createOutline(editor, target, _token) {
    const widget = editor.widget;
    if (!widget) {
      return void 0;
    }
    return new ChatOutline(widget, target);
  }
};
ChatOutlineCreator = __decorateClass([
  __decorateParam(0, IOutlineService)
], ChatOutlineCreator);
export {
  ChatOutlineCreator
};
