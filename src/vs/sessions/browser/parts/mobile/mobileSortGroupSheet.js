import "./media/mobileSortGroupSheet.css";
import * as DOM from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Gesture, EventType as TouchEventType } from "../../../../base/browser/touch.js";
import { localize } from "../../../../nls.js";
const $ = DOM.$;
function showMobileSortGroupSheet(workbenchContainer, title, items) {
  return new Promise((resolve) => {
    const disposables = [];
    let resolved = false;
    const finish = (id) => {
      if (resolved) {
        return;
      }
      resolved = true;
      sheet.classList.add("closing");
      backdrop.classList.add("closing");
      DOM.getWindow(workbenchContainer).setTimeout(() => {
        for (const d of disposables) {
          try {
            d();
          } catch {
          }
        }
        overlay.remove();
        resolve(id);
      }, 180);
    };
    const overlay = DOM.append(workbenchContainer, $("div.mobile-sort-group-sheet-overlay"));
    const backdrop = DOM.append(overlay, $("div.mobile-sort-group-sheet-backdrop"));
    const sheet = DOM.append(overlay, $("div.mobile-sort-group-sheet"));
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", title);
    DOM.append(sheet, $("div.mobile-sort-group-sheet-handle"));
    const header = DOM.append(sheet, $("div.mobile-sort-group-sheet-header"));
    DOM.append(header, $("div.mobile-sort-group-sheet-title")).textContent = title;
    const closeBtn = DOM.append(header, $("button.mobile-sort-group-sheet-close", { type: "button" }));
    closeBtn.setAttribute("aria-label", localize("sortGroupSheet.close", "Close"));
    DOM.append(closeBtn, $("span")).classList.add(...ThemeIcon.asClassNameArray(Codicon.close));
    const closeGesture = Gesture.addTarget(closeBtn);
    disposables.push(() => closeGesture.dispose());
    const closeClick = DOM.addDisposableListener(closeBtn, DOM.EventType.CLICK, (e) => {
      e.preventDefault();
      finish(void 0);
    });
    disposables.push(() => closeClick.dispose());
    const closeTap = DOM.addDisposableListener(closeBtn, TouchEventType.Tap, () => finish(void 0));
    disposables.push(() => closeTap.dispose());
    const list = DOM.append(sheet, $("div.mobile-sort-group-sheet-list"));
    list.setAttribute("role", "listbox");
    let lastGroup;
    let firstRow;
    let firstCheckedRow;
    for (const item of items) {
      if (item.group !== lastGroup) {
        if (lastGroup !== void 0) {
          DOM.append(list, $("div.mobile-sort-group-sheet-divider"));
        }
        if (item.groupTitle) {
          const sectionTitle = DOM.append(list, $("div.mobile-sort-group-sheet-section-title"));
          sectionTitle.textContent = item.groupTitle;
        }
        lastGroup = item.group;
      }
      const row = DOM.append(list, $("button.mobile-sort-group-sheet-item", { type: "button" }));
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(item.checked));
      if (item.checked) {
        row.classList.add("checked");
      }
      firstRow ??= row;
      if (item.checked && !firstCheckedRow) {
        firstCheckedRow = row;
      }
      const checkSlot = DOM.append(row, $("span.mobile-sort-group-sheet-check"));
      if (item.checked) {
        checkSlot.classList.add(...ThemeIcon.asClassNameArray(Codicon.check));
      }
      DOM.append(row, $("span.mobile-sort-group-sheet-label")).textContent = item.label;
      const rowGesture = Gesture.addTarget(row);
      disposables.push(() => rowGesture.dispose());
      const rowClick = DOM.addDisposableListener(row, DOM.EventType.CLICK, (e) => {
        e.preventDefault();
        finish(item.id);
      });
      disposables.push(() => rowClick.dispose());
      const rowTap = DOM.addDisposableListener(row, TouchEventType.Tap, () => finish(item.id));
      disposables.push(() => rowTap.dispose());
    }
    const backdropClick = DOM.addDisposableListener(backdrop, DOM.EventType.CLICK, () => finish(void 0));
    disposables.push(() => backdropClick.dispose());
    const backdropGesture = Gesture.addTarget(backdrop);
    disposables.push(() => backdropGesture.dispose());
    const backdropTap = DOM.addDisposableListener(backdrop, TouchEventType.Tap, () => finish(void 0));
    disposables.push(() => backdropTap.dispose());
    const keyHandler = DOM.addDisposableListener(DOM.getWindow(workbenchContainer), DOM.EventType.KEY_DOWN, (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(void 0);
      }
    }, true);
    disposables.push(() => keyHandler.dispose());
    (firstCheckedRow ?? firstRow)?.focus();
  });
}
export {
  showMobileSortGroupSheet
};
