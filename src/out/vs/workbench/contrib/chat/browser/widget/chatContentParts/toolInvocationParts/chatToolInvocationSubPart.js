import { Codicon } from "../../../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../../base/common/themables.js";
import { IChatToolInvocation, ToolConfirmKind } from "../../../../common/chatService/chatService.js";
class BaseChatToolInvocationSubPart extends Disposable {
  constructor(toolInvocation) {
    super();
    this.toolInvocation = toolInvocation;
    this._onNeedsRerender = this._register(new Emitter());
    this.onNeedsRerender = this._onNeedsRerender.event;
    this._codeBlocksPartId = "tool-" + BaseChatToolInvocationSubPart.idPool++;
  }
  static {
    this.idPool = 0;
  }
  get codeblocksPartId() {
    return this._codeBlocksPartId;
  }
  getIcon() {
    const toolInvocation = this.toolInvocation;
    const confirmState = IChatToolInvocation.executionConfirmedOrDenied(toolInvocation);
    const isSkipped = confirmState?.type === ToolConfirmKind.Skipped;
    if (isSkipped) {
      return Codicon.circleSlash;
    }
    return confirmState?.type === ToolConfirmKind.Denied ? Codicon.error : IChatToolInvocation.isComplete(toolInvocation) ? Codicon.check : ThemeIcon.modify(Codicon.loading, "spin");
  }
  /**
   * Like {@link getIcon} but never returns the looping loading spinner — progress rows convey
   * activity via shimmer instead, so an in-progress row uses a (hidden) check rather than a spinner.
   */
  getProgressIcon() {
    const icon = this.getIcon();
    return ThemeIcon.isEqual(icon, ThemeIcon.modify(Codicon.loading, "spin")) ? Codicon.check : icon;
  }
}
export {
  BaseChatToolInvocationSubPart
};
