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
import { AbstractDialogHandler } from "../../../../platform/dialogs/common/dialogs.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import Severity from "../../../../base/common/severity.js";
import { Dialog, DialogContentsAlignment } from "../../../../base/browser/ui/dialog/dialog.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IMarkdownRendererService, openLinkFromMarkdown } from "../../../../platform/markdown/browser/markdownRenderer.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { createWorkbenchDialogOptions } from "./dialog.js";
import { IHostService } from "../../../services/host/browser/host.js";
let BrowserDialogHandler = class extends AbstractDialogHandler {
  constructor(logService, layoutService, keybindingService, instantiationService, clipboardService, openerService, markdownRendererService, hostService) {
    super();
    this.logService = logService;
    this.layoutService = layoutService;
    this.keybindingService = keybindingService;
    this.clipboardService = clipboardService;
    this.openerService = openerService;
    this.markdownRendererService = markdownRendererService;
    this.hostService = hostService;
  }
  static {
    this.ALLOWABLE_COMMANDS = /* @__PURE__ */ new Set([
      "copy",
      "cut",
      "editor.action.selectAll",
      "editor.action.clipboardCopyAction",
      "editor.action.clipboardCutAction",
      "editor.action.clipboardPasteAction"
    ]);
  }
  async prompt(prompt) {
    this.logService.trace("DialogService#prompt", prompt.message);
    const buttons = this.getPromptButtons(prompt);
    const { button, checkboxChecked } = await this.doShow(prompt.type, prompt.message, buttons, prompt.detail, prompt.cancelButton ? buttons.length - 1 : -1, prompt.checkbox, void 0, typeof prompt?.custom === "object" ? prompt.custom : void 0, prompt.token);
    return this.getPromptResult(prompt, button, checkboxChecked);
  }
  async confirm(confirmation) {
    this.logService.trace("DialogService#confirm", confirmation.message);
    const buttons = this.getConfirmationButtons(confirmation);
    const { button, checkboxChecked } = await this.doShow(confirmation.type ?? "question", confirmation.message, buttons, confirmation.detail, buttons.length - 1, confirmation.checkbox, void 0, typeof confirmation?.custom === "object" ? confirmation.custom : void 0, confirmation.token);
    return { confirmed: button === 0, checkboxChecked };
  }
  async input(input) {
    this.logService.trace("DialogService#input", input.message);
    const buttons = this.getInputButtons(input);
    const { button, checkboxChecked, values } = await this.doShow(input.type ?? "question", input.message, buttons, input.detail, buttons.length - 1, input?.checkbox, input.inputs, typeof input.custom === "object" ? input.custom : void 0, input.token);
    return { confirmed: button === 0, checkboxChecked, values };
  }
  async about(title, details, detailsToCopy) {
    const { button } = await this.doShow(
      Severity.Info,
      title,
      [
        localize({ key: "copy", comment: ["&& denotes a mnemonic"] }, "&&Copy"),
        localize("ok", "OK")
      ],
      details,
      1
    );
    if (button === 0) {
      this.clipboardService.writeText(detailsToCopy);
    }
  }
  /** Default link handler for Markdown rendered within a dialog, see {@link openLinkFromMarkdown}. */
  defaultMarkdownActionHandler(link, mdStr) {
    return openLinkFromMarkdown(
      this.openerService,
      link,
      mdStr.isTrusted,
      true
      /* skip URL validation to prevent another dialog from showing which is unsupported */
    );
  }
  async doShow(type, message, buttons, detail, cancelId, checkbox, inputs, customOptions, token) {
    const dialogDisposables = new DisposableStore();
    const detailElement = typeof detail === "object" ? dialogDisposables.add(this.markdownRendererService.render(detail, {
      actionHandler: (link, mdStr) => this.defaultMarkdownActionHandler(link, mdStr)
    })).element : void 0;
    const renderBody = customOptions ? (parent) => {
      parent.classList.add(...customOptions.classes || []);
      customOptions.markdownDetails?.forEach((markdownDetail) => {
        const result2 = dialogDisposables.add(this.markdownRendererService.render(markdownDetail.markdown, {
          actionHandler: markdownDetail.actionHandler || ((link, mdStr) => this.defaultMarkdownActionHandler(link, mdStr))
        }));
        parent.appendChild(result2.element);
        result2.element.classList.add(...markdownDetail.classes || []);
      });
    } : void 0;
    const dialog = new Dialog(
      this.layoutService.activeContainer,
      message,
      buttons,
      createWorkbenchDialogOptions({
        detail: typeof detail === "string" ? detail : void 0,
        detailElement,
        cancelId,
        type: this.getDialogType(type),
        renderBody,
        icon: customOptions?.icon,
        alignment: customOptions?.alignment === "vertical" ? DialogContentsAlignment.Vertical : DialogContentsAlignment.Horizontal,
        disableCloseAction: customOptions?.disableCloseAction,
        buttonOptions: customOptions?.buttonDetails?.map((detail2) => ({ sublabel: detail2 })),
        checkboxLabel: checkbox?.label,
        checkboxChecked: checkbox?.checked,
        inputs
      }, this.keybindingService, this.layoutService, this.hostService, BrowserDialogHandler.ALLOWABLE_COMMANDS)
    );
    dialogDisposables.add(dialog);
    if (token) {
      dialogDisposables.add(token.onCancellationRequested(() => dialogDisposables.dispose()));
    }
    const result = await dialog.show();
    dialogDisposables.dispose();
    return result;
  }
};
BrowserDialogHandler = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, ILayoutService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IClipboardService),
  __decorateParam(5, IOpenerService),
  __decorateParam(6, IMarkdownRendererService),
  __decorateParam(7, IHostService)
], BrowserDialogHandler);
export {
  BrowserDialogHandler
};
