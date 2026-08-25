import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
const IChatAttachmentWidgetRegistry = createDecorator("chatAttachmentWidgetRegistry");
class ChatAttachmentWidgetRegistry {
  constructor() {
    this._factories = /* @__PURE__ */ new Map();
  }
  registerFactory(kind, factory) {
    this._factories.set(kind, factory);
    return {
      dispose: () => {
        if (this._factories.get(kind) === factory) {
          this._factories.delete(kind);
        }
      }
    };
  }
  createWidget(attachment, options, container) {
    const factory = this._factories.get(attachment.kind);
    if (!factory) {
      return void 0;
    }
    return factory(attachment, options, container);
  }
}
export {
  ChatAttachmentWidgetRegistry,
  IChatAttachmentWidgetRegistry
};
