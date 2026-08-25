import { AccessibleViewType, AccessibleViewProviderId } from "../../../../platform/accessibility/browser/accessibleView.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { GettingStartedPage, inWelcomeContext } from "./gettingStarted.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IWalkthroughsService } from "./gettingStartedService.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { GettingStartedInput } from "./gettingStartedInput.js";
import { localize } from "../../../../nls.js";
import { Action } from "../../../../base/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { URI } from "../../../../base/common/uri.js";
import { parse } from "../../../../base/common/marshalling.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Codicon } from "../../../../base/common/codicons.js";
class GettingStartedAccessibleView {
  constructor() {
    this.type = AccessibleViewType.View;
    this.priority = 110;
    this.name = "walkthroughs";
    this.when = inWelcomeContext;
    this.getProvider = (accessor) => {
      const editorService = accessor.get(IEditorService);
      const editorPane = editorService.activeEditorPane;
      if (!(editorPane instanceof GettingStartedPage)) {
        return;
      }
      const gettingStartedInput = editorPane.input;
      if (!(gettingStartedInput instanceof GettingStartedInput) || !gettingStartedInput.selectedCategory) {
        return;
      }
      const gettingStartedService = accessor.get(IWalkthroughsService);
      const currentWalkthrough = gettingStartedService.getWalkthrough(gettingStartedInput.selectedCategory);
      const currentStepIds = gettingStartedInput.selectedStep;
      if (currentWalkthrough) {
        return new GettingStartedAccessibleProvider(
          accessor.get(IContextKeyService),
          accessor.get(ICommandService),
          accessor.get(IOpenerService),
          editorPane,
          currentWalkthrough,
          currentStepIds
        );
      }
      return;
    };
  }
}
class GettingStartedAccessibleProvider extends Disposable {
  constructor(contextService, commandService, openerService, _gettingStartedPage, _walkthrough, _focusedStep) {
    super();
    this.contextService = contextService;
    this.commandService = commandService;
    this.openerService = openerService;
    this._gettingStartedPage = _gettingStartedPage;
    this._walkthrough = _walkthrough;
    this._focusedStep = _focusedStep;
    this._currentStepIndex = 0;
    this._activeWalkthroughSteps = [];
    this.id = AccessibleViewProviderId.Walkthrough;
    this.verbositySettingKey = AccessibilityVerbositySettingId.Walkthrough;
    this.options = { type: AccessibleViewType.View };
    this._activeWalkthroughSteps = _walkthrough.steps.filter((step) => !step.when || this.contextService.contextMatchesRules(step.when));
  }
  get actions() {
    const actions = [];
    const step = this._activeWalkthroughSteps[this._currentStepIndex];
    const nodes = step.description.map((lt) => lt.nodes.filter((node) => typeof node !== "string").map((node) => ({ href: node.href, label: node.label }))).flat();
    if (nodes.length === 1) {
      const node = nodes[0];
      actions.push(new Action("walthrough.step.action", node.label, ThemeIcon.asClassName(Codicon.run), true, () => {
        const isCommand = node.href.startsWith("command:");
        const command = node.href.replace(/command:(toSide:)?/, "command:");
        if (isCommand) {
          const commandURI = URI.parse(command);
          let args = [];
          try {
            args = parse(decodeURIComponent(commandURI.query));
          } catch {
            try {
              args = parse(commandURI.query);
            } catch {
            }
          }
          if (!Array.isArray(args)) {
            args = [args];
          }
          this.commandService.executeCommand(commandURI.path, ...args);
        } else {
          this.openerService.open(command, { allowCommands: true });
        }
      }));
    }
    return actions;
  }
  provideContent() {
    if (this._focusedStep) {
      const stepIndex = this._activeWalkthroughSteps.findIndex((step) => step.id === this._focusedStep);
      if (stepIndex !== -1) {
        this._currentStepIndex = stepIndex;
      }
    }
    return this._getContent(
      this._walkthrough,
      this._activeWalkthroughSteps[this._currentStepIndex],
      /* includeTitle */
      true
    );
  }
  _getContent(waltkrough, step, includeTitle) {
    const description = step.description.map((lt) => lt.nodes.filter((node) => typeof node === "string")).join("\n");
    const stepsContent = localize("gettingStarted.step", "{0}\n{1}", step.title, description);
    if (includeTitle) {
      return [
        localize("gettingStarted.title", "Title: {0}", waltkrough.title),
        localize("gettingStarted.description", "Description: {0}", waltkrough.description),
        stepsContent
      ].join("\n");
    } else {
      return stepsContent;
    }
  }
  provideNextContent() {
    if (++this._currentStepIndex >= this._activeWalkthroughSteps.length) {
      --this._currentStepIndex;
      return;
    }
    return this._getContent(this._walkthrough, this._activeWalkthroughSteps[this._currentStepIndex]);
  }
  providePreviousContent() {
    if (--this._currentStepIndex < 0) {
      ++this._currentStepIndex;
      return;
    }
    return this._getContent(this._walkthrough, this._activeWalkthroughSteps[this._currentStepIndex]);
  }
  onClose() {
    if (this._currentStepIndex > -1) {
      const currentStep = this._activeWalkthroughSteps[this._currentStepIndex];
      this._gettingStartedPage.makeCategoryVisibleWhenAvailable(this._walkthrough.id, currentStep.id);
    }
  }
}
export {
  GettingStartedAccessibleView
};
