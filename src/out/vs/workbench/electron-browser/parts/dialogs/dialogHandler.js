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
import { localize } from "../../../../nls.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { AbstractDialogHandler } from "../../../../platform/dialogs/common/dialogs.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { getActiveWindow } from "../../../../base/browser/dom.js";
import { renderAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
let NativeDialogHandler = class extends AbstractDialogHandler {
  constructor(logService, nativeHostService, clipboardService) {
    super();
    this.logService = logService;
    this.nativeHostService = nativeHostService;
    this.clipboardService = clipboardService;
  }
  /**
   * Native Electron message boxes have no Markdown rendering capability, so
   * a Markdown `detail` is degraded to its plain-text equivalent rather than
   * shown with raw Markdown/link syntax.
   */
  toNativeDetail(detail) {
    return typeof detail === "object" ? renderAsPlaintext(detail) : detail;
  }
  async prompt(prompt) {
    this.logService.trace("DialogService#prompt", prompt.message);
    const buttons = this.getPromptButtons(prompt);
    const { response, checkboxChecked } = await this.nativeHostService.showMessageBox({
      type: this.getDialogType(prompt.type),
      title: prompt.title,
      message: prompt.message,
      detail: this.toNativeDetail(prompt.detail),
      buttons,
      cancelId: prompt.cancelButton ? buttons.length - 1 : -1,
      checkboxLabel: prompt.checkbox?.label,
      checkboxChecked: prompt.checkbox?.checked,
      targetWindowId: getActiveWindow().vscodeWindowId
    });
    return this.getPromptResult(prompt, response, checkboxChecked);
  }
  async confirm(confirmation) {
    this.logService.trace("DialogService#confirm", confirmation.message);
    const buttons = this.getConfirmationButtons(confirmation);
    const { response, checkboxChecked } = await this.nativeHostService.showMessageBox({
      type: this.getDialogType(confirmation.type) ?? "question",
      title: confirmation.title,
      message: confirmation.message,
      detail: this.toNativeDetail(confirmation.detail),
      buttons,
      cancelId: buttons.length - 1,
      checkboxLabel: confirmation.checkbox?.label,
      checkboxChecked: confirmation.checkbox?.checked,
      targetWindowId: getActiveWindow().vscodeWindowId
    });
    return { confirmed: response === 0, checkboxChecked };
  }
  input() {
    throw new Error("Unsupported");
  }
  async about(title, details, detailsToCopy) {
    const { response } = await this.nativeHostService.showMessageBox({
      type: "info",
      message: title,
      detail: `
${details}`,
      buttons: [
        localize({ key: "copy", comment: ["&& denotes a mnemonic"] }, "&&Copy"),
        localize("okButton", "OK")
      ],
      targetWindowId: getActiveWindow().vscodeWindowId
    });
    if (response === 0) {
      this.clipboardService.writeText(detailsToCopy);
    }
  }
};
NativeDialogHandler = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, INativeHostService),
  __decorateParam(2, IClipboardService)
], NativeDialogHandler);
export {
  NativeDialogHandler
};
