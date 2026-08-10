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
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { AnchorAlignment } from "../../../../base/common/layout.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { isWeb } from "../../../../base/common/platform.js";
import { localize } from "../../../../nls.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { DisablementReason, IUpdateService, StateType } from "../../../../platform/update/common/update.js";
import { InEditorZenModeContext } from "../../../common/contextkeys.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IChatService } from "../../chat/common/chatService/chatService.js";
import { computeProgressPercent } from "../common/updateUtils.js";
import "./media/updateTitleBarEntry.css";
import { UpdateTooltip } from "./updateTooltip.js";
const UPDATE_TITLE_BAR_ACTION_ID = "workbench.actions.updateIndicator";
const UPDATE_TITLE_BAR_CONTEXT = new RawContextKey("updateTitleBar", false);
const UPDATE_TITLE_BAR_CHAT_IN_PROGRESS_CONTEXT = new RawContextKey("updateTitleBarChatRequestInProgress", false);
const DISABLED_REMINDER_LAST_SHOWN_KEY = "update/disabledReminderLastShown";
const DISABLED_REMINDER_PERIOD = 30 * 24 * 60 * 60 * 1e3;
const UPDATE_TITLE_BAR_SETTING = "update.titleBar";
const ACTIONABLE_STATES = [StateType.AvailableForDownload, StateType.Downloaded, StateType.Ready];
const DETAILED_STATES = [...ACTIONABLE_STATES, StateType.CheckingForUpdates, StateType.Downloading, StateType.Updating, StateType.Overwriting, StateType.Cancelling];
let additionalMenuPlacement;
function registerUpdateTitleBarMenuPlacement(menuId, item = {}) {
  if (additionalMenuPlacement) {
    throw new Error("An additional update title bar menu placement is already registered");
  }
  additionalMenuPlacement = { menuId, item };
}
registerAction2(class UpdateIndicatorTitleBarAction extends Action2 {
  constructor() {
    super({
      id: UPDATE_TITLE_BAR_ACTION_ID,
      title: localize("updateIndicatorTitleBarAction", "Update"),
      f1: false,
      menu: [{
        id: MenuId.TitleBarUpdate,
        order: 0,
        when: ContextKeyExpr.and(UPDATE_TITLE_BAR_CONTEXT, InEditorZenModeContext.negate(), ContextKeyExpr.not("inDebugMode"), UPDATE_TITLE_BAR_CHAT_IN_PROGRESS_CONTEXT.negate())
      }]
    });
  }
  async run() {
  }
});
let UpdateTitleBarContribution = class extends Disposable {
  constructor(actionViewItemService, chatService, configurationService, contextKeyService, hostService, instantiationService, storageService, updateService) {
    super();
    this.configurationService = configurationService;
    this.hostService = hostService;
    this.storageService = storageService;
    this.tooltipVisible = false;
    this.tooltipFocused = false;
    if (isWeb) {
      return;
    }
    this.context = UPDATE_TITLE_BAR_CONTEXT.bindTo(contextKeyService);
    this.tooltip = this._register(instantiationService.createInstance(UpdateTooltip));
    const chatInProgressContext = UPDATE_TITLE_BAR_CHAT_IN_PROGRESS_CONTEXT.bindTo(contextKeyService);
    this._register(autorun((reader) => {
      chatInProgressContext.set(chatService.requestInProgressObs.read(reader));
    }));
    this.state = updateService.state;
    this._register(updateService.onStateChange((state) => {
      this.state = state;
      this.onStateChange();
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(UPDATE_TITLE_BAR_SETTING)) {
        this.onStateChange();
      }
    }));
    this._register(actionViewItemService.register(
      MenuId.TitleBarUpdate,
      UPDATE_TITLE_BAR_ACTION_ID,
      (action, options) => this.createEntry(instantiationService, action, options)
    ));
    if (additionalMenuPlacement) {
      const { menuId, item } = additionalMenuPlacement;
      MenuRegistry.appendMenuItem(menuId, {
        ...item,
        command: {
          id: UPDATE_TITLE_BAR_ACTION_ID,
          title: localize("updateIndicatorTitleBarAction", "Update")
        },
        when: ContextKeyExpr.and(UPDATE_TITLE_BAR_CONTEXT, UPDATE_TITLE_BAR_CHAT_IN_PROGRESS_CONTEXT.negate(), item.when)
      });
      this._register(actionViewItemService.register(
        menuId,
        UPDATE_TITLE_BAR_ACTION_ID,
        (action, options) => this.createEntry(instantiationService, action, options)
      ));
    }
    void this.onStateChange(true);
  }
  createEntry(instantiationService, action, options) {
    this.entry = instantiationService.createInstance(UpdateTitleBarEntry, action, options, this.tooltip, (focus) => {
      this.tooltipVisible = true;
      this.tooltipFocused = focus;
    }, () => {
      this.tooltipVisible = false;
      this.tooltipFocused = false;
      if (!ACTIONABLE_STATES.includes(this.state.type) && !DETAILED_STATES.includes(this.state.type)) {
        this.context.set(false);
      }
    });
    if (this.tooltipVisible) {
      this.entry.showTooltip(this.tooltipFocused);
    }
    return this.entry;
  }
  async onStateChange(startup = false) {
    if (this.configurationService.getValue(UPDATE_TITLE_BAR_SETTING) === false) {
      this.tooltipVisible = false;
      this.tooltipFocused = false;
      this.context.set(false);
      return;
    }
    if (this.tooltipVisible || !await this.hostService.hadLastFocus()) {
      this.context.set(this.tooltipVisible || ACTIONABLE_STATES.includes(this.state.type));
      this.tooltip.renderState(this.state);
      return;
    }
    this.tooltip.renderState(this.state);
    let context = ACTIONABLE_STATES.includes(this.state.type);
    let showTooltip = false;
    switch (this.state.type) {
      case StateType.Disabled:
        if (startup) {
          const reason = this.state.reason;
          if (reason === DisablementReason.InvalidConfiguration || reason === DisablementReason.RunningAsAdmin) {
            const lastShown = this.storageService.getNumber(DISABLED_REMINDER_LAST_SHOWN_KEY, StorageScope.APPLICATION);
            showTooltip = lastShown === void 0 || Date.now() - lastShown >= DISABLED_REMINDER_PERIOD;
          }
        }
        break;
      case StateType.Idle:
        showTooltip = !!this.state.error;
        break;
      case StateType.Downloading:
      case StateType.Updating:
      case StateType.Overwriting:
        context = this.state.explicit;
        break;
      case StateType.Cancelling:
        context = true;
        break;
      case StateType.Restarting:
        context = true;
        break;
    }
    if (showTooltip) {
      this.tooltipVisible = true;
      context = true;
    }
    this.context.set(context);
    if (showTooltip) {
      this.entry?.showTooltip();
      if (this.state.type === StateType.Disabled) {
        this.storageService.store(DISABLED_REMINDER_LAST_SHOWN_KEY, Date.now(), StorageScope.APPLICATION, StorageTarget.MACHINE);
      }
    }
  }
};
UpdateTitleBarContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IChatService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IHostService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IUpdateService)
], UpdateTitleBarContribution);
let UpdateTitleBarEntry = class extends BaseActionViewItem {
  constructor(action, options, tooltip, onDidShowTooltip, onUserDismissedTooltip, commandService, hoverService, telemetryService, updateService) {
    super(void 0, action, options);
    this.tooltip = tooltip;
    this.onDidShowTooltip = onDidShowTooltip;
    this.onUserDismissedTooltip = onUserDismissedTooltip;
    this.commandService = commandService;
    this.hoverService = hoverService;
    this.telemetryService = telemetryService;
    this.updateService = updateService;
    this.visibleTooltip = this._register(new MutableDisposable());
    this.action.run = () => this.runAction();
    this._register(this.updateService.onStateChange((state) => this.onStateChange(state)));
  }
  render(container) {
    super.render(container);
    this.content = dom.append(container, dom.$(".update-indicator"));
    container.setAttribute("role", "button");
    this.updateTooltip();
    this.onStateChange(this.updateService.state);
    if (this.tooltipFocusOnRender !== void 0) {
      const focus = this.tooltipFocusOnRender;
      this.tooltipFocusOnRender = void 0;
      dom.scheduleAtNextAnimationFrame(dom.getWindow(container), () => this.showTooltip(focus));
    }
  }
  showTooltip(focus = false) {
    if (!this.element?.isConnected) {
      this.tooltipFocusOnRender = focus;
      return;
    }
    const hover = this.hoverService.showInstantHover({
      content: this.tooltip.domNode,
      target: {
        targetElements: [this.element],
        dispose: () => {
          if (!!this.element?.isConnected) {
            this.onUserDismissedTooltip();
          }
        }
      },
      persistence: { sticky: true },
      appearance: { showPointer: true, compact: true },
      position: { anchorAlignment: AnchorAlignment.RIGHT }
    }, focus);
    if (hover) {
      this.visibleTooltip.value = hover;
      this.onDidShowTooltip(focus);
    }
  }
  getHoverContents() {
    return this.tooltip.domNode;
  }
  getHoverOptions() {
    return { position: { anchorAlignment: AnchorAlignment.RIGHT } };
  }
  async runAction() {
    let commandId;
    switch (this.updateService.state.type) {
      case StateType.AvailableForDownload:
        commandId = "update.downloadNow";
        break;
      case StateType.Downloaded:
        commandId = "update.install";
        break;
      case StateType.Ready:
        commandId = "update.restart";
        break;
      default:
        this.showTooltip(true);
        return;
    }
    this.telemetryService.publicLog2("workbenchActionExecuted", { id: commandId, from: "titlebar" });
    await this.commandService.executeCommand(commandId);
  }
  onStateChange(state) {
    if (!this.content) {
      return;
    }
    dom.clearNode(this.content);
    this.content.classList.remove("prominent", "progress-indefinite", "progress-percent", "update-disabled");
    this.content.style.removeProperty("--update-progress");
    const label = dom.append(this.content, dom.$(".indicator-label"));
    switch (state.type) {
      case StateType.Disabled:
        label.textContent = localize("updateIndicator.update", "Update");
        this.content.classList.add("update-disabled");
        break;
      case StateType.CheckingForUpdates:
        label.textContent = localize("updateIndicator.checking", "Checking...");
        this.renderProgressState(this.content);
        break;
      case StateType.Overwriting:
        label.textContent = localize("updateIndicator.overwriting", "Updating...");
        this.renderProgressState(this.content);
        break;
      case StateType.AvailableForDownload:
      case StateType.Downloaded:
      case StateType.Ready:
        label.textContent = localize("updateIndicator.update", "Update");
        this.content.classList.add("prominent");
        break;
      case StateType.Downloading:
        label.textContent = localize("updateIndicator.downloading", "Downloading...");
        this.renderProgressState(this.content, computeProgressPercent(state.downloadedBytes, state.totalBytes));
        break;
      case StateType.Updating:
        label.textContent = localize("updateIndicator.installing", "Installing...");
        this.renderProgressState(this.content, computeProgressPercent(state.currentProgress, state.maxProgress));
        break;
      case StateType.Restarting:
        label.textContent = localize("updateIndicator.restarting", "Restarting...");
        this.renderProgressState(this.content);
        break;
      case StateType.Cancelling:
        label.textContent = localize("updateIndicator.cancelling", "Cancelling...");
        this.renderProgressState(this.content);
        break;
      default:
        label.textContent = localize("updateIndicator.update", "Update");
        break;
    }
    this.element?.setAttribute("aria-label", label.textContent);
  }
  renderProgressState(content, percentage) {
    if (percentage !== void 0) {
      content.classList.add("progress-percent");
      content.style.setProperty("--update-progress", `${percentage}%`);
    } else {
      content.classList.add("progress-indefinite");
    }
  }
};
UpdateTitleBarEntry = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IUpdateService)
], UpdateTitleBarEntry);
export {
  UpdateTitleBarContribution,
  UpdateTitleBarEntry,
  registerUpdateTitleBarMenuPlacement
};
