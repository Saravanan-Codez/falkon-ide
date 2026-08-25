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
import "./media/chatSubagentOpenChat.css";
import { $, addDisposableListener, EventHelper, EventType, isHTMLElement, WindowIntervalTimer } from "../../../../../../base/browser/dom.js";
import { BaseActionViewItem } from "../../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { createPixelSpinner } from "../../../../../../base/browser/ui/pixelSpinner/pixelSpinner.js";
import { Action } from "../../../../../../base/common/actions.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { URI } from "../../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../../nls.js";
import { IAccessibilityService } from "../../../../../../platform/accessibility/common/accessibility.js";
import { IActionViewItemService } from "../../../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, MenuId, MenuItemAction, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { parseChatUri } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IMarkdownRendererService } from "../../../../../../platform/markdown/browser/markdownRenderer.js";
import { INotificationService } from "../../../../../../platform/notification/common/notification.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../common/contributions.js";
import { ACTIVE_GROUP } from "../../../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../../../services/environment/common/environmentService.js";
import { formatElapsedTime } from "../../../common/chatProgressFormatting.js";
import { CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID, CHAT_SUBAGENT_RESOURCE_QUERY_PARAM } from "../../../common/constants.js";
import { ILanguageModelsService } from "../../../common/languageModels.js";
import { IChatWidgetService } from "../../chat.js";
import { renderFileWidgets } from "./chatInlineAnchorWidget.js";
import { IChatMarkdownAnchorService } from "./chatMarkdownAnchorService.js";
class SubagentChatOpenerRegistry {
  constructor() {
    this.openers = /* @__PURE__ */ new Set();
  }
  register(opener) {
    this.openers.add(opener);
    return toDisposable(() => this.openers.delete(opener));
  }
  async open(context) {
    for (const opener of this.openers) {
      if (await opener.open(context)) {
        return true;
      }
    }
    return false;
  }
}
const subagentChatOpenerRegistry = new SubagentChatOpenerRegistry();
function asOpenSubagentChatContext(context) {
  if (typeof context === "string") {
    return { chatResource: context };
  }
  if (context && typeof context === "object" && typeof context.chatResource === "string") {
    return context;
  }
  return void 0;
}
function getSubagentEditorResource(context) {
  const parsed = parseChatUri(context.chatResource);
  if (!parsed || !context.parentSessionResource) {
    return void 0;
  }
  try {
    const parentSessionResource = URI.parse(context.parentSessionResource);
    const query = new URLSearchParams(parentSessionResource.query);
    query.set(CHAT_SUBAGENT_RESOURCE_QUERY_PARAM, context.chatResource);
    return parentSessionResource.with({ fragment: parsed.chatId, query: query.toString() });
  } catch {
    return void 0;
  }
}
function shouldShowSubagentModel(subagentModelName, parentModelId, parentModelName, parentModelMetadataId) {
  if (!subagentModelName) {
    return false;
  }
  const normalizedSubagentModel = subagentModelName.trim().toLowerCase();
  const parentModelIdSuffix = parentModelId?.slice(parentModelId.lastIndexOf(":") + 1);
  return ![parentModelId, parentModelIdSuffix, parentModelName, parentModelMetadataId].some((candidate) => candidate?.trim().toLowerCase() === normalizedSubagentModel);
}
function formatCompactSubagentDuration(startedAt, duration, now = Date.now()) {
  const end = duration === void 0 ? now : startedAt + Math.max(0, duration);
  return formatElapsedTime(Math.max(0, end - startedAt));
}
function shouldAnimateSubagentToolTransition(displayedToolCallId, displayedIsTool, targetToolCallId, targetIsTool) {
  if (!displayedIsTool && !targetIsTool) {
    return false;
  }
  return displayedIsTool !== targetIsTool || displayedToolCallId !== targetToolCallId;
}
function createOpenSubagentAction(action) {
  const proxy = new Action(action.id, action.label, action.class, false, (context) => action.run(context));
  proxy.tooltip = action.tooltip;
  return proxy;
}
function createEditorOpenSubagentAction(action, chatWidgetService, notificationService) {
  const proxy = new Action(action.id, action.label, action.class, false, async (rawContext) => {
    const context = asOpenSubagentChatContext(rawContext);
    const resource = context && getSubagentEditorResource(context);
    if (!resource) {
      notificationService.error(localize("chat.subagent.openChat.invalidResource", "The subagent chat could not be opened."));
      return;
    }
    await chatWidgetService.openSession(resource, ACTIVE_GROUP, {
      pinned: true,
      revealIfOpened: true,
      title: context.title ? { preferred: context.title } : void 0
    });
  });
  proxy.tooltip = action.tooltip;
  return proxy;
}
class OpenSubagentChatAction extends Action2 {
  constructor() {
    super({
      id: CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID,
      title: localize2("chat.subagent.openChat", "Open Subagent"),
      icon: Codicon.commentDiscussion,
      f1: false,
      menu: { id: MenuId.ChatSubagentContent, group: "navigation" }
    });
  }
  async run(accessor, rawContext) {
    const notificationService = accessor.get(INotificationService);
    const chatWidgetService = accessor.get(IChatWidgetService);
    const context = asOpenSubagentChatContext(rawContext);
    if (!context) {
      throw new Error("Cannot open a subagent chat without a chat resource");
    }
    if (await subagentChatOpenerRegistry.open(context)) {
      return;
    }
    const resource = getSubagentEditorResource(context);
    if (!resource) {
      notificationService.error(localize("chat.subagent.openChat.invalidResource", "The subagent chat could not be opened."));
      return;
    }
    await chatWidgetService.openSession(resource, ACTIVE_GROUP, {
      pinned: true,
      revealIfOpened: true,
      title: context.title ? { preferred: context.title } : void 0
    });
  }
}
registerAction2(OpenSubagentChatAction);
let OpenSubagentChatActionViewItem = class extends BaseActionViewItem {
  constructor(context, action, options, openInEditor = false, markdownRendererService, instantiationService, chatMarkdownAnchorService, accessibilityService, chatWidgetService, notificationService, languageModelsService, hoverService) {
    super(context, openInEditor ? createEditorOpenSubagentAction(action, chatWidgetService, notificationService) : createOpenSubagentAction(action), options);
    this.markdownRendererService = markdownRendererService;
    this.instantiationService = instantiationService;
    this.chatMarkdownAnchorService = chatMarkdownAnchorService;
    this.accessibilityService = accessibilityService;
    this.languageModelsService = languageModelsService;
    this.hoverService = hoverService;
    this._confirmationCount = 0;
    this._spinner = this._register(new MutableDisposable());
    this._durationTimer = this._register(new WindowIntervalTimer());
    this._toolTransition = this._register(new MutableDisposable());
    this._activeToolRendered = this._register(new MutableDisposable());
    this._activeToolFileWidgets = this._register(new DisposableStore());
    this._pillHover = this._register(new MutableDisposable());
    this._enabledTracker = this._register(new MutableDisposable());
    this._targetActivityIsTool = false;
    this._displayedActivityIsTool = false;
    this._toolTransitionPhase = "idle";
    this._sourceAction = action;
    this._showElapsedOnly = openInEditor;
    if (this._action instanceof Action) {
      this._register(this._action);
    }
    this._register(this.accessibilityService.onDidChangeReducedMotion(() => {
      if (this.accessibilityService.isMotionReduced()) {
        this._finishToolTransition();
      }
    }));
  }
  render(container) {
    super.render(container);
    container.classList.add("chat-subagent-pill-widget");
    container.setAttribute("role", "button");
    this._iconElement = $("span.chat-subagent-pill-icon");
    this._iconElement.appendChild($(`span.chat-subagent-pill-open-icon${ThemeIcon.asCSSSelector(Codicon.commentDiscussion)}`));
    this._labelElement = $("span.chat-subagent-pill-label");
    this._modelElement = $("span.chat-subagent-pill-model.hidden");
    this._confirmationCountElement = $("span.chat-subagent-pill-confirmation-count");
    const pillContent = $("span.chat-subagent-pill-content");
    this._pillContentElement = pillContent;
    const pillHeader = $("span.chat-subagent-pill-header");
    this._durationElement = $("span.chat-subagent-pill-duration.hidden");
    this._activeToolElement = $("span.chat-subagent-pill-active-tool.hidden");
    this._activeToolElement.inert = true;
    const connector = $("span.chat-subagent-pill-active-tool-connector");
    connector.setAttribute("aria-hidden", "true");
    this._activeToolIconElement = $("span.chat-subagent-pill-active-tool-icon");
    this._activeToolIconElement.setAttribute("aria-hidden", "true");
    this._activeToolLabelElement = $(".chat-subagent-pill-active-tool-label");
    this._activeToolElement.append(connector, this._activeToolIconElement, this._activeToolLabelElement);
    pillContent.append(this._iconElement, this._labelElement, this._modelElement, this._confirmationCountElement);
    pillHeader.append(pillContent, this._durationElement);
    container.append(pillHeader, this._activeToolElement);
    this._pillHover.value = this.hoverService.setupDelayedHover(pillContent, () => ({ content: this.getTooltip() ?? "" }));
    this._update();
  }
  onClick(event, preserveFocus = false) {
    const target = event.target;
    if (!this._pillContentElement || !isHTMLElement(target) || !this._pillContentElement.contains(target)) {
      EventHelper.stop(event, true);
      return;
    }
    super.onClick(event, preserveFocus);
  }
  setActionContext(newContext) {
    const previousResource = asOpenSubagentChatContext(this._context)?.chatResource;
    super.setActionContext(newContext);
    const resource = asOpenSubagentChatContext(newContext)?.chatResource;
    if (resource !== previousResource) {
      this._trackedEnabled = void 0;
      this._resolvedTitle = void 0;
      this._reportedModelName = void 0;
      this._restartEnabledTracker();
    }
    this._update();
  }
  _update() {
    if (!this.element) {
      return;
    }
    const context = asOpenSubagentChatContext(this._context);
    const enabled = this._trackedEnabled ?? (!!context && !!getSubagentEditorResource(context));
    this._setEnabled(enabled);
    this._setResolvedTitle(context?.title || this._resolvedTitle);
    this._reportedModelName = context?.modelName;
    const parentModel = context?.parentModelId ? this.languageModelsService.lookupLanguageModel(context.parentModelId) : void 0;
    const contextModelName = shouldShowSubagentModel(context?.modelName, context?.parentModelId, context?.parentModelName ?? parentModel?.name, context?.parentResolvedModelId ?? parentModel?.id) ? context?.modelName : void 0;
    this._setModelName(contextModelName);
    this._updateConfirmationCount(context);
    this._updateStatus(context);
    this._updateDuration(context);
    const activeToolLabel = context?.isActive ? context.activeToolLabel : void 0;
    this._setActiveTool(
      context?.isActive ? activeToolLabel ?? localize("chat.subagent.working", "Working on it...") : void 0,
      context?.isActive ? context.activeToolIcon ?? (activeToolLabel ? void 0 : Codicon.comment) : void 0,
      context?.isActive ? context.activeToolCallId : void 0,
      !!activeToolLabel
    );
    this.updateTooltip();
    this.updateEnabled();
    this.updateAriaLabel();
  }
  trackEnabled(tracker) {
    this._enabledTrackerFactory = tracker;
    this._restartEnabledTracker();
  }
  _restartEnabledTracker() {
    const context = asOpenSubagentChatContext(this._context);
    if (!context || !this._enabledTrackerFactory) {
      this._enabledTracker.clear();
      return;
    }
    this._enabledTracker.value = this._enabledTrackerFactory(context, (enabled) => {
      this._trackedEnabled = enabled;
      this._setEnabled(enabled);
    });
  }
  _setEnabled(enabled) {
    this._action.enabled = enabled;
    this._sourceAction.enabled = enabled;
    this.updateEnabled();
  }
  _setModelName(modelName) {
    if (this._modelElement) {
      this._modelElement.textContent = modelName ?? "";
      this._modelElement.classList.toggle("hidden", !modelName);
    }
  }
  _updateStatus(context) {
    const status = (context?.confirmationCount ?? 0) > 0 ? "waiting" : context?.isActive === true ? "running" : context?.isActive === false ? "completed" : void 0;
    if (status === this._renderedStatus) {
      return;
    }
    this._renderedStatus = status;
    const waiting = status === "waiting";
    const running = status === "running";
    this.element?.classList.toggle("chat-subagent-running", running);
    this.element?.classList.toggle("chat-subagent-waiting", waiting);
    this._spinner.clear();
    if ((running || waiting) && this._iconElement) {
      const store = new DisposableStore();
      const spinner = store.add(createPixelSpinner(this._iconElement, { variant: waiting ? "ring" : "grid" }));
      store.add(toDisposable(() => spinner.element.remove()));
      this._spinner.value = store;
    }
  }
  _updateConfirmationCount(context) {
    const count = context?.confirmationCount ?? 0;
    const confirmationActive = !!context?.confirmationActive;
    this._confirmationCount = count;
    this.element?.classList.toggle("chat-subagent-needs-confirmation", count > 0);
    this.element?.classList.toggle("chat-subagent-has-multiple-confirmations", count > 1);
    this.element?.classList.toggle("chat-subagent-confirmation-active", count > 0 && confirmationActive);
    this.element?.classList.toggle("chat-subagent-confirmation-pending", count > 0 && !confirmationActive);
    if (this._confirmationCountElement) {
      this._confirmationCountElement.textContent = String(count);
    }
  }
  _updateDuration(context) {
    this._durationTimer.cancel();
    const startedAt = context?.startedAt;
    const durationValue = context?.duration;
    if (!this._durationElement || startedAt === void 0) {
      this._durationElement?.classList.add("hidden");
      return;
    }
    const update = () => {
      const duration = formatCompactSubagentDuration(startedAt, durationValue);
      this._durationElement.textContent = this._showElapsedOnly ? duration : durationValue === void 0 ? localize("chat.subagent.workingDuration", "Working for {0}", duration) : localize("chat.subagent.workedDuration", "Worked for {0}", duration);
      this.updateAriaLabel();
    };
    update();
    this._durationElement.classList.remove("hidden");
    if (durationValue === void 0) {
      this._durationTimer.cancelAndSet(update, 1e3);
    }
  }
  _setActiveTool(label, icon, toolCallId, isTool) {
    this._targetToolLabel = label;
    this._targetToolIcon = icon;
    this._targetToolCallId = toolCallId;
    this._targetActivityIsTool = isTool;
    if (!this._activeToolElement || !this._activeToolLabelElement || !this._activeToolIconElement) {
      return;
    }
    this._activeToolElement.classList.toggle("hidden", !label);
    if (!label) {
      this._toolTransition.clear();
      this._toolTransitionPhase = "idle";
      this._clearToolTransitionClasses();
      this._activeToolRendered.clear();
      this._activeToolFileWidgets.clear();
      this._activeToolLabelElement.textContent = "";
      this._displayedToolLabel = void 0;
      this._displayedToolIcon = void 0;
      this._displayedToolCallId = void 0;
      this._displayedToolAccessibleLabel = void 0;
      this._displayedActivityIsTool = false;
      this._renderActiveToolIcon(void 0);
      return;
    }
    if (!this._displayedToolLabel || this.accessibilityService.isMotionReduced()) {
      this._finishToolTransition();
      return;
    }
    if (this._toolTransitionPhase === "idle" && !shouldAnimateSubagentToolTransition(this._displayedToolCallId, this._displayedActivityIsTool, toolCallId, isTool)) {
      this._setDisplayedTool(label, icon, toolCallId, isTool);
      return;
    }
    this._runToolTransition();
  }
  _runToolTransition() {
    if (!this._activeToolLabelElement || this._toolTransitionPhase !== "idle") {
      return;
    }
    if (!shouldAnimateSubagentToolTransition(this._displayedToolCallId, this._displayedActivityIsTool, this._targetToolCallId, this._targetActivityIsTool)) {
      if (this._targetToolLabel !== this._displayedToolLabel || this._targetToolIcon?.id !== this._displayedToolIcon?.id || this._targetToolCallId !== this._displayedToolCallId || this._targetActivityIsTool !== this._displayedActivityIsTool) {
        this._setDisplayedTool(this._targetToolLabel ?? "", this._targetToolIcon, this._targetToolCallId, this._targetActivityIsTool);
      }
      return;
    }
    this._toolTransitionPhase = "out";
    if (!this._restartToolTransition("chat-subagent-tool-fade-out")) {
      this._completeToolTransition();
    }
  }
  _completeToolTransition() {
    this._toolTransition.clear();
    if (this._toolTransitionPhase === "out") {
      this._toolTransitionPhase = "in";
      this._setDisplayedTool(this._targetToolLabel ?? "", this._targetToolIcon, this._targetToolCallId, this._targetActivityIsTool);
      if (!this._restartToolTransition("chat-subagent-tool-fade-in")) {
        this._completeToolTransition();
      }
      return;
    }
    if (this._toolTransitionPhase === "in") {
      this._clearToolTransitionClasses();
      this._toolTransitionPhase = "idle";
      this._runToolTransition();
    }
  }
  _finishToolTransition() {
    this._toolTransition.clear();
    this._toolTransitionPhase = "idle";
    this._clearToolTransitionClasses();
    if (this._targetToolLabel) {
      this._setDisplayedTool(this._targetToolLabel, this._targetToolIcon, this._targetToolCallId, this._targetActivityIsTool);
    }
  }
  _setDisplayedTool(label, icon, toolCallId, isTool) {
    if (!this._activeToolLabelElement) {
      return;
    }
    this._activeToolRendered.clear();
    this._activeToolFileWidgets.clear();
    this._activeToolLabelElement.textContent = "";
    const rendered = this.markdownRendererService.render(new MarkdownString(label), void 0, this._activeToolLabelElement);
    renderFileWidgets(rendered.element, this.instantiationService, this.chatMarkdownAnchorService, this._activeToolFileWidgets);
    this._activeToolRendered.value = rendered;
    this._displayedToolLabel = label;
    this._displayedToolIcon = icon;
    this._displayedToolCallId = toolCallId;
    this._displayedToolAccessibleLabel = rendered.element.textContent?.replace(/\s+/g, " ").trim() || label;
    this._displayedActivityIsTool = isTool;
    this._renderActiveToolIcon(icon);
    this.updateTooltip();
    this.updateAriaLabel();
  }
  _renderActiveToolIcon(icon) {
    if (!this._activeToolIconElement) {
      return;
    }
    this._activeToolIconElement.className = "chat-subagent-pill-active-tool-icon";
    if (icon) {
      this._activeToolIconElement.classList.add(...ThemeIcon.asClassNameArray(icon));
    }
  }
  _clearToolTransitionClasses() {
    this._activeToolLabelElement?.classList.remove("chat-subagent-tool-fade-in", "chat-subagent-tool-fade-out");
  }
  _restartToolTransition(className) {
    if (!this._activeToolLabelElement) {
      return false;
    }
    this._toolTransition.clear();
    this._clearToolTransitionClasses();
    const transition = new DisposableStore();
    const complete = (event) => {
      if (event.target === this._activeToolLabelElement) {
        this._completeToolTransition();
      }
    };
    transition.add(addDisposableListener(this._activeToolLabelElement, EventType.ANIMATION_END, complete));
    transition.add(addDisposableListener(this._activeToolLabelElement, "animationcancel", complete));
    this._toolTransition.value = transition;
    void this._activeToolLabelElement.offsetWidth;
    this._activeToolLabelElement.classList.add(className);
    if (this._activeToolLabelElement.getAnimations().length === 0) {
      this._toolTransition.clear();
      this._clearToolTransitionClasses();
      return false;
    }
    return true;
  }
  _setResolvedTitle(title) {
    this._resolvedTitle = title;
    if (this._labelElement) {
      this._labelElement.textContent = title || this._action.label;
    }
  }
  getTooltip() {
    const details = [];
    if (this._confirmationCount > 0) {
      details.push(this._confirmationCount === 1 ? localize("chat.subagent.openChat.confirmationTooltip", "Open subagent chat (1 confirmation needed)") : localize("chat.subagent.openChat.confirmationsTooltip", "Open subagent chat ({0} confirmations needed)", this._confirmationCount));
    } else {
      details.push(this._resolvedTitle ? localize("chat.subagent.openChat.aria", "Open subagent chat: {0}", this._resolvedTitle) : this._action.label);
    }
    if (this._reportedModelName) {
      details.push(localize("chat.subagent.modelTooltip", "Model: {0}", this._reportedModelName));
    }
    if (this._displayedToolAccessibleLabel && this._displayedActivityIsTool) {
      details.push(localize("chat.subagent.activeToolTooltip", "Active tool: {0}", this._displayedToolAccessibleLabel));
    }
    return details.join("\n");
  }
  updateTooltip() {
    this.updateAriaLabel();
  }
  updateEnabled() {
    if (!this.element) {
      return;
    }
    const enabled = this._action.enabled;
    this.element.classList.toggle("disabled", !enabled);
    this.element.classList.toggle("hidden", !enabled);
    this.element.setAttribute("aria-disabled", String(!enabled));
    this.element.setAttribute("aria-hidden", String(!enabled));
  }
  updateAriaLabel() {
    if (!this.element) {
      return;
    }
    const label = this._resolvedTitle ? localize("chat.subagent.openChat.aria", "Open subagent chat: {0}", this._resolvedTitle) : this._action.label;
    const status = this._renderedStatus === "running" ? localize("chat.subagent.status.working", "Subagent is working") : this._renderedStatus === "waiting" ? localize("chat.subagent.status.waiting", "Subagent is waiting for input") : this._renderedStatus === "completed" ? localize("chat.subagent.status.completed", "Subagent completed") : void 0;
    const model = this._reportedModelName ? localize("chat.subagent.modelAria", "Model {0}", this._reportedModelName) : void 0;
    const activeTool = this._displayedToolAccessibleLabel && this._displayedActivityIsTool ? localize("chat.subagent.activeToolAria", "Active tool {0}", this._displayedToolAccessibleLabel) : void 0;
    const duration = this._durationElement?.textContent;
    this.element.setAttribute("aria-label", [label, status, model, activeTool, duration].filter(Boolean).join(". "));
  }
};
OpenSubagentChatActionViewItem = __decorateClass([
  __decorateParam(4, IMarkdownRendererService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IChatMarkdownAnchorService),
  __decorateParam(7, IAccessibilityService),
  __decorateParam(8, IChatWidgetService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, ILanguageModelsService),
  __decorateParam(11, IHoverService)
], OpenSubagentChatActionViewItem);
let EditorOpenSubagentChatActionViewItemContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.editorOpenSubagentChatActionViewItem";
  }
  constructor(actionViewItemService, environmentService) {
    super();
    if (environmentService.isSessionsWindow) {
      return;
    }
    const onDidRegister = this._register(new Emitter());
    this._register(actionViewItemService.register(MenuId.ChatSubagentContent, CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID, (action, options, instantiationService) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(OpenSubagentChatActionViewItem, void 0, action, options, true);
    }, onDidRegister.event));
    onDidRegister.fire();
  }
};
EditorOpenSubagentChatActionViewItemContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IWorkbenchEnvironmentService)
], EditorOpenSubagentChatActionViewItemContribution);
registerWorkbenchContribution2(EditorOpenSubagentChatActionViewItemContribution.ID, EditorOpenSubagentChatActionViewItemContribution, WorkbenchPhase.BlockStartup);
export {
  OpenSubagentChatActionViewItem,
  formatCompactSubagentDuration,
  getSubagentEditorResource,
  shouldAnimateSubagentToolTransition,
  shouldShowSubagentModel,
  subagentChatOpenerRegistry
};
