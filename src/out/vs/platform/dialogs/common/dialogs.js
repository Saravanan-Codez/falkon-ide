import { basename } from "../../../base/common/resources.js";
import Severity from "../../../base/common/severity.js";
import { localize } from "../../../nls.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IDialogService = createDecorator("dialogService");
var DialogKind = /* @__PURE__ */ ((DialogKind2) => {
  DialogKind2[DialogKind2["Confirmation"] = 1] = "Confirmation";
  DialogKind2[DialogKind2["Prompt"] = 2] = "Prompt";
  DialogKind2[DialogKind2["Input"] = 3] = "Input";
  return DialogKind2;
})(DialogKind || {});
class AbstractDialogHandler {
  getConfirmationButtons(dialog) {
    return this.getButtons(dialog, 1 /* Confirmation */);
  }
  getPromptButtons(dialog) {
    return this.getButtons(dialog, 2 /* Prompt */);
  }
  getInputButtons(dialog) {
    return this.getButtons(dialog, 3 /* Input */);
  }
  getButtons(dialog, kind) {
    const buttons = [];
    switch (kind) {
      case 1 /* Confirmation */: {
        const confirmationDialog = dialog;
        if (confirmationDialog.primaryButton) {
          buttons.push(confirmationDialog.primaryButton);
        } else {
          buttons.push(localize({ key: "yesButton", comment: ["&& denotes a mnemonic"] }, "&&Yes"));
        }
        if (confirmationDialog.cancelButton) {
          buttons.push(confirmationDialog.cancelButton);
        } else {
          buttons.push(localize("cancelButton", "Cancel"));
        }
        break;
      }
      case 2 /* Prompt */: {
        const promptDialog = dialog;
        if (Array.isArray(promptDialog.buttons) && promptDialog.buttons.length > 0) {
          buttons.push(...promptDialog.buttons.map((button) => button.label));
        }
        if (promptDialog.cancelButton) {
          if (promptDialog.cancelButton === true) {
            buttons.push(localize("cancelButton", "Cancel"));
          } else if (typeof promptDialog.cancelButton === "string") {
            buttons.push(promptDialog.cancelButton);
          } else {
            if (promptDialog.cancelButton.label) {
              buttons.push(promptDialog.cancelButton.label);
            } else {
              buttons.push(localize("cancelButton", "Cancel"));
            }
          }
        }
        if (buttons.length === 0) {
          buttons.push(localize({ key: "okButton", comment: ["&& denotes a mnemonic"] }, "&&OK"));
        }
        break;
      }
      case 3 /* Input */: {
        const inputDialog = dialog;
        if (inputDialog.primaryButton) {
          buttons.push(inputDialog.primaryButton);
        } else {
          buttons.push(localize({ key: "okButton", comment: ["&& denotes a mnemonic"] }, "&&OK"));
        }
        if (inputDialog.cancelButton) {
          buttons.push(inputDialog.cancelButton);
        } else {
          buttons.push(localize("cancelButton", "Cancel"));
        }
        break;
      }
    }
    return buttons;
  }
  getDialogType(type) {
    if (typeof type === "string") {
      return type;
    }
    if (typeof type === "number") {
      return type === Severity.Info ? "info" : type === Severity.Error ? "error" : type === Severity.Warning ? "warning" : "none";
    }
    return void 0;
  }
  getPromptResult(prompt, buttonIndex, checkboxChecked) {
    const promptButtons = [...prompt.buttons ?? []];
    if (prompt.cancelButton && typeof prompt.cancelButton !== "string" && typeof prompt.cancelButton !== "boolean") {
      promptButtons.push(prompt.cancelButton);
    }
    let result = promptButtons[buttonIndex]?.run({ checkboxChecked });
    if (!(result instanceof Promise)) {
      result = Promise.resolve(result);
    }
    return { result, checkboxChecked };
  }
}
const IFileDialogService = createDecorator("fileDialogService");
var ConfirmResult = /* @__PURE__ */ ((ConfirmResult2) => {
  ConfirmResult2[ConfirmResult2["SAVE"] = 0] = "SAVE";
  ConfirmResult2[ConfirmResult2["DONT_SAVE"] = 1] = "DONT_SAVE";
  ConfirmResult2[ConfirmResult2["CANCEL"] = 2] = "CANCEL";
  return ConfirmResult2;
})(ConfirmResult || {});
const MAX_CONFIRM_FILES = 10;
function getFileNamesMessage(fileNamesOrResources) {
  const message = [];
  message.push(...fileNamesOrResources.slice(0, MAX_CONFIRM_FILES).map((fileNameOrResource) => typeof fileNameOrResource === "string" ? fileNameOrResource : basename(fileNameOrResource)));
  if (fileNamesOrResources.length > MAX_CONFIRM_FILES) {
    if (fileNamesOrResources.length - MAX_CONFIRM_FILES === 1) {
      message.push(localize("moreFile", "...1 additional file not shown"));
    } else {
      message.push(localize("moreFiles", "...{0} additional files not shown", fileNamesOrResources.length - MAX_CONFIRM_FILES));
    }
  }
  message.push("");
  return message.join("\n");
}
export {
  AbstractDialogHandler,
  ConfirmResult,
  IDialogService,
  IFileDialogService,
  getFileNamesMessage
};
