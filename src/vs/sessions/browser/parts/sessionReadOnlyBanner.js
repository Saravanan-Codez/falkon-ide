import "./media/sessionReadOnlyBanner.css";
import * as dom from "../../../base/browser/dom.js";
import { renderIcon } from "../../../base/browser/ui/iconLabel/iconLabels.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { Codicon } from "../../../base/common/codicons.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { localize } from "../../../nls.js";
class SessionReadOnlyBanner extends Disposable {
  constructor() {
    super();
    this._visible = false;
    this._actionDisposables = this._register(new DisposableStore());
    this.domNode = dom.$(".session-readonly-banner");
    this.domNode.setAttribute("role", "status");
    const icon = dom.append(this.domNode, dom.$(".session-readonly-banner-icon"));
    icon.appendChild(renderIcon(Codicon.lock));
    this._text = dom.append(this.domNode, dom.$("span.session-readonly-banner-text"));
    this._actionContainer = dom.append(this.domNode, dom.$("span.session-readonly-banner-action"));
    this.setContent({ message: localize("sessionReadOnlyBanner.message", "This chat is read-only") });
    this.setVisible(false);
  }
  get visible() {
    return this._visible;
  }
  setVisible(visible) {
    this._visible = visible;
    this.domNode.classList.toggle("hidden", !visible);
  }
  setContent(content) {
    this._text.textContent = content.message;
    this._actionDisposables.clear();
    dom.clearNode(this._actionContainer);
    if (content.action) {
      const link = dom.append(this._actionContainer, dom.$("a.session-readonly-banner-action-link"));
      link.textContent = content.action.label;
      link.setAttribute("role", "button");
      link.tabIndex = 0;
      const run = content.action.run;
      this._actionDisposables.add(dom.addDisposableListener(link, dom.EventType.CLICK, (e) => {
        dom.EventHelper.stop(e, true);
        run();
      }));
      this._actionDisposables.add(dom.addDisposableListener(link, dom.EventType.KEY_DOWN, (e) => {
        const event = new StandardKeyboardEvent(e);
        if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
          dom.EventHelper.stop(e, true);
          run();
        }
      }));
    }
  }
}
export {
  SessionReadOnlyBanner
};
