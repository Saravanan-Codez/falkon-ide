import * as dom from "../../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { ChatErrorLevel } from "../../../common/chatService/chatService.js";
const $ = dom.$;
class ChatErrorContentPart extends Disposable {
  constructor(kind, content, errorDetails, renderer) {
    super();
    this.errorDetails = errorDetails;
    this.domNode = this._register(new ChatErrorWidget(kind, content, renderer)).domNode;
  }
  hasSameContent(other) {
    return other.kind === this.errorDetails.kind;
  }
}
class ChatErrorWidget extends Disposable {
  constructor(kind, content, renderer) {
    super();
    this.domNode = $(".chat-notification-widget");
    this.domNode.tabIndex = 0;
    let icon;
    let iconClass;
    switch (kind) {
      case ChatErrorLevel.Warning:
        icon = Codicon.warning;
        iconClass = ".chat-warning-codicon";
        break;
      case ChatErrorLevel.Error:
        icon = Codicon.error;
        iconClass = ".chat-error-codicon";
        break;
      case ChatErrorLevel.Info:
        icon = Codicon.info;
        iconClass = ".chat-info-codicon";
        break;
    }
    this.domNode.appendChild($(iconClass, void 0, renderIcon(icon)));
    const markdownContent = this._register(renderer.render(content));
    this.domNode.appendChild(markdownContent.element);
  }
}
export {
  ChatErrorContentPart,
  ChatErrorWidget
};
