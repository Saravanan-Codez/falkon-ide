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
import * as dom from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { Event } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IssueReporterEditorInput } from "../browser/issueReporterEditorInput.js";
import { IssueReporterEditorPane, IssueReporterOpenContext } from "./issueReporterEditorPane.js";
const ISSUE_REPORTER_CAPTURE_SCREENSHOT_COMMAND_ID = "workbench.action.issueReporter.captureScreenshot";
const ISSUE_REPORTER_TOGGLE_RECORDING_COMMAND_ID = "workbench.action.issueReporter.toggleRecording";
let IssueReporterOpenStateContribution = class extends Disposable {
  constructor(editorService, contextKeyService, commandService) {
    super();
    this.editorService = editorService;
    this.commandService = commandService;
    this.issueReporterOpen = false;
    const ctx = IssueReporterOpenContext.bindTo(contextKeyService);
    const update = () => {
      this.issueReporterOpen = this.editorService.editors.some((e) => e instanceof IssueReporterEditorInput);
      ctx.set(this.issueReporterOpen);
    };
    this._register(this.editorService.onDidEditorsChange(update));
    update();
    this._register(Event.runAndSubscribe(dom.onDidRegisterWindow, ({ window, disposables }) => {
      disposables.add(dom.addDisposableListener(
        window,
        dom.EventType.KEY_DOWN,
        (e) => this.dispatchCapturePhase(e),
        true
        /* capture */
      ));
    }, { window: mainWindow, disposables: this._store }));
  }
  static {
    this.ID = "workbench.contrib.issueReporterOpenState";
  }
  dispatchCapturePhase(e) {
    if (!this.issueReporterOpen) {
      return;
    }
    const evt = new StandardKeyboardEvent(e);
    const primaryMod = isMacintosh ? evt.metaKey : evt.ctrlKey;
    const otherMod = isMacintosh ? evt.ctrlKey : evt.metaKey;
    if (!primaryMod || !evt.shiftKey || evt.altKey || otherMod) {
      return;
    }
    let commandId;
    if (evt.keyCode === KeyCode.KeyS) {
      commandId = ISSUE_REPORTER_CAPTURE_SCREENSHOT_COMMAND_ID;
    } else if (evt.keyCode === KeyCode.KeyR) {
      commandId = ISSUE_REPORTER_TOGGLE_RECORDING_COMMAND_ID;
    }
    if (!commandId) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    void this.commandService.executeCommand(commandId);
  }
};
IssueReporterOpenStateContribution = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, ICommandService)
], IssueReporterOpenStateContribution);
registerWorkbenchContribution2(IssueReporterOpenStateContribution.ID, IssueReporterOpenStateContribution, WorkbenchPhase.AfterRestored);
function withWizard(fn) {
  const pane = IssueReporterEditorPane.getAnyLiveInstance();
  const wizard = pane?.getWizard();
  if (pane && wizard) {
    fn(pane, wizard);
  }
}
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: ISSUE_REPORTER_CAPTURE_SCREENSHOT_COMMAND_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  when: IssueReporterOpenContext,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS,
  handler: () => withWizard((_pane, wizard) => wizard.triggerCaptureScreenshot())
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: ISSUE_REPORTER_TOGGLE_RECORDING_COMMAND_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  when: IssueReporterOpenContext,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR,
  handler: () => withWizard((_pane, wizard) => wizard.triggerToggleRecording())
});
export {
  ISSUE_REPORTER_CAPTURE_SCREENSHOT_COMMAND_ID,
  ISSUE_REPORTER_TOGGLE_RECORDING_COMMAND_ID
};
