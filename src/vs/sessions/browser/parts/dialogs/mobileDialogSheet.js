import { $, addDisposableListener, append, getActiveElement, isHTMLElement } from "../../../../base/browser/dom.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { showMobileContentSheet } from "../mobile/mobilePickerSheet.js";
let idSeed = 0;
async function showMobileDialogSheet(layoutService, options) {
  const cancelIndex = options.buttons.findIndex((button) => button.isCancel);
  let chosenButton = cancelIndex;
  let checkboxChecked = options.checkbox?.checked;
  const previouslyFocused = getActiveElement();
  await showMobileContentSheet(
    layoutService.mainContainer,
    options.title,
    (body, api) => {
      const store = new DisposableStore();
      const id = `mobile-dialog-${++idSeed}`;
      const describedBy = [];
      const message = append(body, $(".mobile-content-sheet-message"));
      message.id = `${id}-message`;
      message.textContent = options.message;
      describedBy.push(message.id);
      if (options.detail) {
        const detail = append(body, $(".mobile-content-sheet-detail"));
        detail.id = `${id}-detail`;
        detail.textContent = options.detail;
        describedBy.push(detail.id);
      }
      body.closest('[role="dialog"]')?.setAttribute("aria-describedby", describedBy.join(" "));
      if (options.checkbox) {
        const row = append(body, $("label.mobile-content-sheet-checkbox"));
        const checkbox = append(row, $("input"));
        checkbox.type = "checkbox";
        checkbox.checked = !!options.checkbox.checked;
        append(row, $("span")).textContent = options.checkbox.label;
        store.add(addDisposableListener(checkbox, "change", () => {
          checkboxChecked = checkbox.checked;
        }));
      }
      const actions = append(body, $(".mobile-content-sheet-actions"));
      let buttonToFocus;
      options.buttons.forEach((descriptor, index) => {
        const button = store.add(new Button(actions, { ...defaultButtonStyles, secondary: descriptor.isCancel }));
        button.label = descriptor.label;
        store.add(button.onDidClick(() => {
          chosenButton = index;
          api.close();
        }));
        if (index === options.defaultButtonIndex) {
          buttonToFocus = button;
        }
      });
      buttonToFocus?.focus();
      return store;
    },
    { hideDoneButton: true }
  );
  if (isHTMLElement(previouslyFocused) && previouslyFocused.isConnected) {
    previouslyFocused.focus();
  }
  return { button: chosenButton, checkboxChecked };
}
export {
  showMobileDialogSheet
};
