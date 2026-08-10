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
import { mnemonicButtonLabel } from "../../../../base/common/labels.js";
import { renderAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
import { localize } from "../../../../nls.js";
import { AbstractDialogHandler } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { BrowserDialogHandler } from "../../../../workbench/browser/parts/dialogs/dialogHandler.js";
import { IWorkbenchLayoutService } from "../../../../workbench/services/layout/browser/layoutService.js";
import { isPhoneLayout } from "../mobile/mobileLayout.js";
import { showMobileDialogSheet } from "./mobileDialogSheet.js";
let MobileAwareDialogHandler = class extends AbstractDialogHandler {
  constructor(instantiationService, _layoutService) {
    super();
    this._layoutService = _layoutService;
    this._desktop = instantiationService.createInstance(BrowserDialogHandler);
  }
  async confirm(confirmation) {
    if (!isPhoneLayout(this._layoutService)) {
      return this._desktop.confirm(confirmation);
    }
    const labels = this.getConfirmationButtons(confirmation);
    const cancelIndex = labels.length - 1;
    const { button, checkboxChecked } = await showMobileDialogSheet(this._layoutService, {
      title: this._titleFor(confirmation.type),
      message: confirmation.message,
      detail: this._toSheetDetail(confirmation.detail),
      buttons: this._toSheetButtons(labels, cancelIndex),
      defaultButtonIndex: cancelIndex,
      checkbox: confirmation.checkbox
    });
    return { confirmed: button === 0, checkboxChecked };
  }
  async prompt(prompt) {
    if (!isPhoneLayout(this._layoutService)) {
      return this._desktop.prompt(prompt);
    }
    const labels = this.getPromptButtons(prompt);
    const cancelIndex = prompt.cancelButton ? labels.length - 1 : -1;
    const { button, checkboxChecked } = await showMobileDialogSheet(this._layoutService, {
      title: this._titleFor(prompt.type),
      message: prompt.message,
      detail: this._toSheetDetail(prompt.detail),
      buttons: this._toSheetButtons(labels, cancelIndex),
      defaultButtonIndex: cancelIndex >= 0 ? cancelIndex : 0,
      checkbox: prompt.checkbox
    });
    return this.getPromptResult(prompt, button, checkboxChecked);
  }
  // Text input and the about dialog keep the desktop rendering for now.
  input(input) {
    return this._desktop.input(input);
  }
  about(title, details, detailsToCopy) {
    return this._desktop.about(title, details, detailsToCopy);
  }
  _toSheetButtons(labels, cancelIndex) {
    return labels.map((label, index) => ({
      label: mnemonicButtonLabel(label, true),
      isCancel: index === cancelIndex
    }));
  }
  /**
   * The mobile bottom sheet renders `detail` as plain text, so a Markdown
   * detail is degraded to its plain-text equivalent rather than shown with
   * raw Markdown/link syntax.
   */
  _toSheetDetail(detail) {
    return typeof detail === "object" ? renderAsPlaintext(detail) : detail;
  }
  _titleFor(type) {
    switch (this.getDialogType(type)) {
      case "error":
        return localize("mobileDialog.error", "Error");
      case "warning":
        return localize("mobileDialog.warning", "Warning");
      default:
        return localize("mobileDialog.confirm", "Confirm");
    }
  }
};
MobileAwareDialogHandler = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkbenchLayoutService)
], MobileAwareDialogHandler);
export {
  MobileAwareDialogHandler
};
