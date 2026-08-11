import { isHTMLElement } from "../../../base/browser/dom.js";
import { isManagedHoverTooltipMarkdownString } from "../../../base/browser/ui/hover/hover.js";
import { HoverPosition } from "../../../base/browser/ui/hover/hoverWidget.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { isMarkdownString } from "../../../base/common/htmlContent.js";
import { isFunction, isString } from "../../../base/common/types.js";
import { localize } from "../../../nls.js";
class ManagedHoverWidget {
  constructor(hoverDelegate, target, fadeInAnimation) {
    this.hoverDelegate = hoverDelegate;
    this.target = target;
    this.fadeInAnimation = fadeInAnimation;
  }
  onDidHide() {
    if (this._cancellationTokenSource) {
      this._cancellationTokenSource.dispose(true);
      this._cancellationTokenSource = void 0;
    }
  }
  async update(content, focus, options) {
    if (this._cancellationTokenSource) {
      this._cancellationTokenSource.dispose(true);
      this._cancellationTokenSource = void 0;
    }
    if (this.isDisposed) {
      return;
    }
    let resolvedContent;
    if (isString(content) || isHTMLElement(content) || content === void 0) {
      resolvedContent = content;
    } else {
      this._cancellationTokenSource = new CancellationTokenSource();
      const token = this._cancellationTokenSource.token;
      let managedContent;
      if (isManagedHoverTooltipMarkdownString(content)) {
        if (isFunction(content.markdown)) {
          managedContent = content.markdown(token).then((resolvedContent2) => resolvedContent2 ?? content.markdownNotSupportedFallback);
        } else {
          managedContent = content.markdown ?? content.markdownNotSupportedFallback;
        }
      } else {
        managedContent = content.element(token);
      }
      if (managedContent instanceof Promise) {
        if (!this._hoverWidget) {
          this.show(localize("iconLabel.loading", "Loading..."), focus, options);
        }
        resolvedContent = await managedContent;
      } else {
        resolvedContent = managedContent;
      }
      if (this.isDisposed || token.isCancellationRequested) {
        return;
      }
    }
    this.show(resolvedContent, focus, options);
  }
  show(content, focus, options) {
    const oldHoverWidget = this._hoverWidget;
    if (this.hasContent(content)) {
      const hoverOptions = {
        content,
        target: this.target,
        actions: options?.actions,
        linkHandler: options?.linkHandler,
        trapFocus: options?.trapFocus,
        appearance: {
          showPointer: this.hoverDelegate.placement === "element",
          skipFadeInAnimation: !this.fadeInAnimation || !!oldHoverWidget,
          // do not fade in if the hover is already showing
          showHoverHint: options?.appearance?.showHoverHint
        },
        position: {
          hoverPosition: HoverPosition.BELOW,
          anchorAlignment: options?.position?.anchorAlignment
        }
      };
      this._hoverWidget = this.hoverDelegate.showHover(hoverOptions, focus);
    }
    oldHoverWidget?.dispose();
  }
  hasContent(content) {
    if (!content) {
      return false;
    }
    if (isMarkdownString(content)) {
      return !!content.value;
    }
    return true;
  }
  get isDisposed() {
    return this._hoverWidget?.isDisposed;
  }
  dispose() {
    this._hoverWidget?.dispose();
    this._cancellationTokenSource?.dispose(true);
    this._cancellationTokenSource = void 0;
  }
}
export {
  ManagedHoverWidget
};
