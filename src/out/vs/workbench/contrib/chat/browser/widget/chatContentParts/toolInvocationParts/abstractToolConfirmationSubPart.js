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
import { Separator } from "../../../../../../../base/common/actions.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { onUnexpectedError } from "../../../../../../../base/common/errors.js";
import { Disposable, toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../../nls.js";
import { IContextKeyService } from "../../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../../platform/keybinding/common/keybinding.js";
import { ConfirmationOptionKind } from "../../../../../../../platform/agentHost/common/state/protocol/state.js";
import { IEditorService } from "../../../../../../services/editor/common/editorService.js";
import { ChatContextKeys } from "../../../../common/actions/chatContextKeys.js";
import { IChatToolInvocation, ToolConfirmKind } from "../../../../common/chatService/chatService.js";
import { ILanguageModelToolsService } from "../../../../common/tools/languageModelToolsService.js";
import { IChatWidgetService } from "../../../chat.js";
import { IChatToolRiskAssessmentService } from "../../../tools/chatToolRiskAssessmentService.js";
import { ChatCustomConfirmationWidget } from "../chatConfirmationWidget.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
import { createApprovalReasonBadge, createToolRiskBadge } from "./toolRiskBadgeHelper.js";
let ChatConfirmationOpenedEditors = class extends Disposable {
  constructor(_toolInvocation, _editorService) {
    super();
    this._toolInvocation = _toolInvocation;
    this._editorService = _editorService;
    this._opened = [];
    this.fileWidgetOptions = {
      trackOpen: (open) => this._trackOpen(open)
    };
  }
  /**
   * The opener API doesn't report which editor it opened, so attribute the editor the click
   * left active. Editors that were already open beforehand are left alone.
   */
  async _trackOpen(open) {
    const before = new Set(this._editorService.editors);
    try {
      await open();
    } finally {
      const pane = this._editorService.activeEditorPane;
      if (pane?.input && !before.has(pane.input)) {
        this._opened.push({ editor: pane.input, groupId: pane.group.id });
      }
    }
  }
  /**
   * A confirmation can be answered by clicking a button, but also by keybinding or voice. All
   * of those transition the invocation out of its waiting state, which re-renders and disposes
   * this sub part, so cleaning up here covers every path. Editors are kept when the part is
   * disposed for any other reason, such as the list virtualizing the response away.
   */
  dispose() {
    const stateKind = this._toolInvocation.state.get().type;
    if (stateKind !== IChatToolInvocation.StateKind.WaitingForConfirmation && stateKind !== IChatToolInvocation.StateKind.WaitingForPostApproval) {
      const toClose = this._opened.filter(({ editor }) => !editor.isDisposed() && !editor.isDirty());
      if (toClose.length) {
        this._editorService.closeEditors(toClose).catch(onUnexpectedError);
      }
    }
    this._opened.length = 0;
    super.dispose();
  }
};
ChatConfirmationOpenedEditors = __decorateClass([
  __decorateParam(1, IEditorService)
], ChatConfirmationOpenedEditors);
let AbstractToolConfirmationSubPart = class extends BaseChatToolInvocationSubPart {
  constructor(toolInvocation, context, instantiationService, keybindingService, contextKeyService, chatWidgetService, languageModelToolsService, riskAssessmentService) {
    super(toolInvocation);
    this.toolInvocation = toolInvocation;
    this.context = context;
    this.instantiationService = instantiationService;
    this.keybindingService = keybindingService;
    this.contextKeyService = contextKeyService;
    this.chatWidgetService = chatWidgetService;
    this.languageModelToolsService = languageModelToolsService;
    this.riskAssessmentService = riskAssessmentService;
    if (toolInvocation.kind !== "toolInvocation") {
      throw new Error("Confirmation only works with live tool invocations");
    }
    this.openedEditors = this._register(instantiationService.createInstance(ChatConfirmationOpenedEditors, toolInvocation));
  }
  render(config) {
    const { keybindingService, languageModelToolsService, toolInvocation } = this;
    const state = toolInvocation.state.get();
    const customOptions = state.type === IChatToolInvocation.StateKind.WaitingForConfirmation ? state.confirmationMessages?.customOptions : void 0;
    let buttons;
    if (customOptions && customOptions.length > 0) {
      buttons = this.buildCustomOptionButtons(toolInvocation, customOptions);
    } else {
      const allowTooltip = keybindingService.appendKeybinding(config.allowLabel, config.allowActionId);
      const skipTooltip = keybindingService.appendKeybinding(config.skipLabel, config.skipActionId);
      const additionalActions = this.additionalPrimaryActions();
      const sessionAction = this.useAllowOnceAsPrimary() ? void 0 : additionalActions.find(
        (action) => "scope" in action && action.scope === "session"
      );
      const allowAction = {
        label: config.allowLabel,
        tooltip: allowTooltip,
        data: () => {
          this.confirmWith(toolInvocation, { type: ToolConfirmKind.UserAction });
        }
      };
      const primaryAction = sessionAction ?? allowAction;
      const moreActions = sessionAction ? [allowAction, ...additionalActions.filter((a) => a !== sessionAction)] : additionalActions;
      buttons = [
        {
          label: primaryAction.label,
          tooltip: primaryAction.tooltip,
          data: primaryAction.data,
          moreActions: moreActions.length > 0 ? moreActions : void 0
        },
        {
          label: localize("skip", "Skip"),
          tooltip: skipTooltip,
          data: () => {
            this.confirmWith(toolInvocation, { type: ToolConfirmKind.Skipped });
          },
          isSecondary: true
        }
      ];
    }
    const contentElement = this.createContentElement();
    const tool = languageModelToolsService.getTool(toolInvocation.toolId);
    const approvalReasonBadge = state.type === IChatToolInvocation.StateKind.WaitingForConfirmation ? createApprovalReasonBadge(this._store, this.instantiationService, state.confirmationMessages?.approvalReason) : void 0;
    const riskBadge = approvalReasonBadge?.domNode ?? (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation ? this.createRiskBadgeDomNode(state.parameters) : void 0);
    const confirmWidget = this._register(this.instantiationService.createInstance(
      ChatCustomConfirmationWidget,
      this.context,
      {
        title: this.getTitle(),
        icon: tool?.icon && "id" in tool.icon ? tool.icon : Codicon.tools,
        subtitle: config.subtitle,
        buttons,
        message: contentElement,
        footerBanner: riskBadge,
        fileWidgetOptions: this.openedEditors.fileWidgetOptions,
        toolbarData: {
          arg: toolInvocation,
          partType: config.partType,
          partSource: toolInvocation.source.type
        }
      }
    ));
    const hasToolConfirmation = ChatContextKeys.Editing.hasToolConfirmation.bindTo(this.contextKeyService);
    hasToolConfirmation.set(true);
    this._register(confirmWidget.onDidClick(({ button, isTouchClick }) => {
      button.data();
      if (!isTouchClick) {
        this.chatWidgetService.getWidgetBySessionResource(this.context.element.sessionResource)?.focusInput();
      }
    }));
    this._register(toDisposable(() => hasToolConfirmation.reset()));
    this.domNode = confirmWidget.domNode;
  }
  confirmWith(toolInvocation, reason) {
    IChatToolInvocation.confirmWith(toolInvocation, reason);
  }
  buildCustomOptionButtons(toolInvocation, options) {
    const approve = [];
    const deny = [];
    for (const option of options) {
      (option.kind === ConfirmationOptionKind.Deny ? deny : approve).push(option);
    }
    const makeAction = (option) => ({
      label: option.label,
      data: () => {
        this.confirmWith(toolInvocation, { type: ToolConfirmKind.UserAction, selectedButton: option.id, selectedButtonKind: option.kind });
      }
    });
    const makeGroupButton = (group, isSecondary) => {
      const [primary, ...rest] = group;
      const button = {
        ...makeAction(primary),
        isSecondary
      };
      if (rest.length > 0) {
        const moreActions = [];
        let prevGroup = primary.group;
        for (const option of rest) {
          if (option.group !== prevGroup) {
            moreActions.push(new Separator());
          }
          moreActions.push(makeAction(option));
          prevGroup = option.group;
        }
        button.moreActions = moreActions;
      }
      return button;
    };
    const buttons = [];
    if (approve.length > 0) {
      buttons.push(makeGroupButton(approve, false));
    }
    if (deny.length > 0) {
      buttons.push(makeGroupButton(deny, approve.length > 0));
    }
    return buttons;
  }
  additionalPrimaryActions() {
    return [];
  }
  /**
   * Create the risk-assessment badge DOM node for this confirmation, or
   * `undefined` when the feature is disabled or the tool is unknown. Returned
   * as a `footerBanner` for the confirmation widget.
   */
  createRiskBadgeDomNode(parameters) {
    return createToolRiskBadge(this._store, this.instantiationService, this.riskAssessmentService, this.languageModelToolsService, this.toolInvocation.toolId, parameters)?.domNode;
  }
  /**
   * When true, "Allow Once" stays the primary button even when a
   * session-scoped action is available. Subclasses override this
   * to keep the simple allow-once default (e.g. when combination
   * approval options are present).
   */
  useAllowOnceAsPrimary() {
    return false;
  }
};
AbstractToolConfirmationSubPart = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IChatWidgetService),
  __decorateParam(6, ILanguageModelToolsService),
  __decorateParam(7, IChatToolRiskAssessmentService)
], AbstractToolConfirmationSubPart);
export {
  AbstractToolConfirmationSubPart,
  ChatConfirmationOpenedEditors
};
