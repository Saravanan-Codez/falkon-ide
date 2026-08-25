import * as DOM from "../../../../../base/browser/dom.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
function setupCollapsibleToggle(chevron, header, contentEl, disposables, initiallyCollapsed = false, scrollable) {
  let collapsed = initiallyCollapsed;
  header.tabIndex = 0;
  header.role = "button";
  chevron.setAttribute("aria-hidden", "true");
  const updateState = () => {
    DOM.clearNode(chevron);
    const icon = collapsed ? Codicon.chevronRight : Codicon.chevronDown;
    chevron.classList.add(...ThemeIcon.asClassName(icon).split(" "));
    contentEl.style.display = collapsed ? "none" : "block";
    header.style.borderRadius = collapsed ? "" : "3px 3px 0 0";
    header.setAttribute("aria-expanded", String(!collapsed));
  };
  updateState();
  disposables.add(DOM.addDisposableListener(header, DOM.EventType.CLICK, () => {
    collapsed = !collapsed;
    chevron.className = "chat-debug-message-section-chevron";
    updateState();
    scrollable?.scanDomNode();
  }));
  disposables.add(DOM.addDisposableListener(header, DOM.EventType.KEY_DOWN, (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      header.click();
    }
  }));
}
export {
  setupCollapsibleToggle
};
