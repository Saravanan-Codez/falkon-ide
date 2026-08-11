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
import "./media/sessionsSetUp.css";
import { Button } from "../../base/browser/ui/button/button.js";
import { Dialog, DialogContentsAlignment } from "../../base/browser/ui/dialog/dialog.js";
import { Codicon } from "../../base/common/codicons.js";
import { onUnexpectedError } from "../../base/common/errors.js";
import { Disposable, DisposableStore } from "../../base/common/lifecycle.js";
import { localize } from "../../nls.js";
import { IKeybindingService } from "../../platform/keybinding/common/keybinding.js";
import { createWorkbenchDialogOptions } from "../../workbench/browser/parts/dialogs/dialog.js";
import { IHostService } from "../../workbench/services/host/browser/host.js";
import { IWorkbenchLayoutService } from "../../workbench/services/layout/browser/layoutService.js";
import { RETURN_TO_VSCODE_EDITOR_COMMAND_ID } from "../common/sessionCommands.js";
function createSessionsSignInDialogOptions(commandService, showReturnToVSCodeEditor) {
  return {
    forceSignInDialog: true,
    dialogIcon: Codicon.agent,
    dialogTitle: localize("sessions.signIn", "Sign in to use Agents"),
    disableCloseButton: true,
    dialogExtraClasses: ["sessions-welcome-dialog"],
    renderDialogFooter: showReturnToVSCodeEditor ? (footer) => createDialogAction(
      footer,
      localize("sessions.returnToVSCodeEditor", "Return to VS Code Editor"),
      () => {
        void commandService.executeCommand(RETURN_TO_VSCODE_EDITOR_COMMAND_ID).catch(onUnexpectedError);
      }
    ) : void 0
  };
}
let SessionsSigningInDialog = class extends Disposable {
  constructor(onCancel, keybindingService, layoutService, hostService) {
    super();
    this.onCancel = onCancel;
    this.isDisposed = false;
    this.didCancel = false;
    this.dialog = this._register(new Dialog(
      layoutService.activeContainer,
      localize("sessions.signingIn", "Signing in\u2026"),
      [],
      createWorkbenchDialogOptions({
        type: "none",
        extraClasses: ["chat-setup-dialog", "sessions-welcome-dialog"],
        detail: localize("sessions.signingIn.detail", "Please complete sign-in in the browser."),
        icon: Codicon.agent,
        alignment: DialogContentsAlignment.Vertical,
        cancelId: 0,
        disableCloseButton: true,
        disableDefaultAction: true,
        renderFooter: (footer) => {
          const element = footer.appendChild(footer.ownerDocument.createElement("div"));
          element.classList.add("chat-setup-dialog-footer");
          this._register(createDialogAction(
            element,
            localize("sessions.cancelSignIn", "Cancel Sign-In"),
            () => this.cancel()
          ));
        }
      }, keybindingService, layoutService, hostService)
    ));
    void this.show();
  }
  async show() {
    await this.dialog.show();
    if (!this.isDisposed) {
      this.cancel();
    }
  }
  cancel() {
    if (this.didCancel) {
      return;
    }
    this.didCancel = true;
    this.onCancel();
  }
  dispose() {
    this.isDisposed = true;
    super.dispose();
  }
};
SessionsSigningInDialog = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IWorkbenchLayoutService),
  __decorateParam(3, IHostService)
], SessionsSigningInDialog);
function createDialogAction(container, label, run) {
  const disposables = new DisposableStore();
  const action = disposables.add(new Button(container, {}));
  action.element.classList.add("sessions-sign-in-dialog-action");
  action.label = label;
  disposables.add(action.onDidClick(run));
  return disposables;
}
export {
  SessionsSigningInDialog,
  createSessionsSignInDialogOptions
};
