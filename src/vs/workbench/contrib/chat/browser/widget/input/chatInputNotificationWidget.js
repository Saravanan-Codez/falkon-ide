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
import * as dom from "../../../../../../base/browser/dom.js";
import { Button } from "../../../../../../base/browser/ui/button/button.js";
import { getDefaultHoverDelegate } from "../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { isMarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IMarkdownRendererService } from "../../../../../../platform/markdown/browser/markdownRenderer.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { defaultButtonStyles } from "../../../../../../platform/theme/browser/defaultStyles.js";
import { ChatInputNotificationActionKind, ChatInputNotificationSeverity, IChatInputNotificationService, isChatInputNotificationApplicableToSession } from "./chatInputNotificationService.js";
import "./media/chatInputNotificationWidget.css";
const $ = dom.$;
const severityToClass = {
  [ChatInputNotificationSeverity.Info]: "severity-info",
  [ChatInputNotificationSeverity.Warning]: "severity-warning",
  [ChatInputNotificationSeverity.Error]: "severity-error"
};
const severityToIcon = {
  [ChatInputNotificationSeverity.Info]: Codicon.info,
  [ChatInputNotificationSeverity.Warning]: Codicon.warning,
  [ChatInputNotificationSeverity.Error]: Codicon.error
};
let ChatInputNotificationWidget = class extends Disposable {
  constructor(_delegate, _notificationService, _commandService, _telemetryService, _markdownRendererService, _hoverService, _logService) {
    super();
    this._delegate = _delegate;
    this._notificationService = _notificationService;
    this._commandService = _commandService;
    this._telemetryService = _telemetryService;
    this._markdownRendererService = _markdownRendererService;
    this._hoverService = _hoverService;
    this._logService = _logService;
    this._contentDisposables = this._register(new DisposableStore());
    this._visible = false;
    this.domNode = $(".chat-input-notification-widget");
    this._register(this._notificationService.onDidChange(() => this._render()));
    this._register(autorun((reader) => {
      this._modelTargetChatSessionType = this._delegate?.modelTargetChatSessionType?.read(reader);
      this._sessionResource = this._delegate?.sessionResource?.read(reader);
      this._render();
    }));
  }
  _render() {
    this._contentDisposables.clear();
    dom.clearNode(this.domNode);
    const notification = this._notificationService.getActiveNotification((n) => this._matchesSession(n));
    this._setVisible(!!notification);
    this._notificationService.announceRendered(notification);
    if (!notification) {
      this.domNode.parentElement?.classList.remove("has-notification");
      this._lastShownTelemetryData = void 0;
      return;
    }
    this.domNode.parentElement?.classList.add("has-notification");
    this._renderNotification(notification);
    this._logShownTelemetry(notification);
  }
  _setVisible(visible) {
    if (this._visible === visible) {
      return;
    }
    this._visible = visible;
    this._delegate?.onDidChangeVisibility?.(visible);
  }
  _matchesSession(notification) {
    return isChatInputNotificationApplicableToSession(notification, this._modelTargetChatSessionType, this._sessionResource);
  }
  _renderNotification(notification) {
    const container = dom.append(this.domNode, $(".chat-input-notification"));
    container.classList.add(severityToClass[notification.severity]);
    const headerRow = dom.append(container, $(".chat-input-notification-header"));
    const iconElement = dom.append(headerRow, $(".chat-input-notification-icon"));
    iconElement.appendChild(dom.$(ThemeIcon.asCSSSelector(severityToIcon[notification.severity])));
    const titleElement = dom.append(headerRow, $(".chat-input-notification-title"));
    if (isMarkdownString(notification.message)) {
      const rendered = this._contentDisposables.add(this._markdownRendererService.render(notification.message));
      rendered.element.classList.add("chat-input-notification-title-markdown");
      titleElement.appendChild(rendered.element);
    } else {
      titleElement.textContent = notification.message;
    }
    const ariaTitle = isMarkdownString(notification.message) ? notification.message.value : notification.message;
    if (notification.mute) {
      const mute = notification.mute;
      const muteButton = dom.append(headerRow, $(".chat-input-notification-mute"));
      muteButton.appendChild(dom.$(ThemeIcon.asCSSSelector(Codicon.bellSlash)));
      muteButton.tabIndex = 0;
      muteButton.role = "button";
      muteButton.ariaLabel = mute.tooltip;
      this._contentDisposables.add(this._hoverService.setupManagedHover(getDefaultHoverDelegate("element"), muteButton, mute.tooltip));
      const doMute = () => queueMicrotask(() => {
        this._telemetryService.publicLog2("workbenchActionExecuted", {
          id: mute.commandId,
          from: "chatInputNotification"
        });
        this._commandService.executeCommand(mute.commandId, ...mute.commandArgs ?? []);
      });
      this._contentDisposables.add(dom.addDisposableListener(muteButton, dom.EventType.CLICK, doMute));
      this._contentDisposables.add(dom.addDisposableListener(muteButton, dom.EventType.KEY_DOWN, (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          doMute();
        }
      }));
    }
    if (notification.dismissible) {
      const dismissButton = dom.append(headerRow, $(".chat-input-notification-dismiss"));
      dismissButton.appendChild(dom.$(ThemeIcon.asCSSSelector(Codicon.close)));
      dismissButton.tabIndex = 0;
      dismissButton.role = "button";
      dismissButton.ariaLabel = localize("dismissNotification", "Dismiss notification");
      const dismiss = () => queueMicrotask(() => {
        this._telemetryService.publicLog2("chatInputNotificationDismissed", this._getTelemetryData(notification));
        this._notificationService.dismissNotification(notification.id);
      });
      this._contentDisposables.add(dom.addDisposableListener(dismissButton, dom.EventType.CLICK, dismiss));
      this._contentDisposables.add(dom.addDisposableListener(dismissButton, dom.EventType.KEY_DOWN, (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dismiss();
        }
      }));
    }
    const actions = notification.actions.filter((action) => this._supportsAction(action));
    const hasBody = notification.description || actions.length > 0;
    if (hasBody) {
      const bodyRow = dom.append(container, $(".chat-input-notification-body"));
      if (notification.description) {
        const descriptionElement = dom.append(bodyRow, $(".chat-input-notification-description"));
        if (isMarkdownString(notification.description)) {
          const rendered = this._contentDisposables.add(this._markdownRendererService.render(notification.description));
          rendered.element.classList.add("chat-input-notification-description-markdown");
          descriptionElement.appendChild(rendered.element);
        } else {
          descriptionElement.textContent = notification.description;
        }
      }
      if (actions.length > 0) {
        const actionsContainer = dom.append(bodyRow, $(".chat-input-notification-actions"));
        for (let i = 0; i < actions.length; i++) {
          const action = actions[i];
          const isLast = i === actions.length - 1;
          const button = this._contentDisposables.add(new Button(actionsContainer, {
            ...defaultButtonStyles,
            ...!isLast ? {
              buttonBackground: void 0,
              buttonHoverBackground: void 0,
              buttonForeground: void 0,
              buttonSecondaryBackground: void 0,
              buttonSecondaryHoverBackground: void 0,
              buttonSecondaryForeground: void 0,
              buttonSecondaryBorder: void 0
            } : {},
            supportIcons: true,
            secondary: !isLast
          }));
          button.element.classList.add("chat-input-notification-action-button");
          button.label = action.label;
          button.element.ariaLabel = `${ariaTitle} ${action.label}`;
          this._contentDisposables.add(button.onDidClick(() => {
            void this._executeAction(notification, action);
          }));
        }
      }
    }
  }
  _supportsAction(action) {
    switch (action.kind) {
      case ChatInputNotificationActionKind.Command:
        return true;
      case ChatInputNotificationActionKind.OpenModelPicker:
        return !!this._delegate?.openModelPicker;
      case ChatInputNotificationActionKind.SwitchToModel:
        return !!this._delegate?.switchToModel;
    }
  }
  async _executeAction(notification, action) {
    this._telemetryService.publicLog2("chatInputNotificationAction", {
      ...this._getTelemetryData(notification),
      actionKind: action.kind
    });
    switch (action.kind) {
      case ChatInputNotificationActionKind.Command:
        try {
          await this._executeCommandAction(action);
        } catch (error) {
          this._logActionError(error);
        }
        break;
      case ChatInputNotificationActionKind.OpenModelPicker:
        this._openModelPicker();
        break;
      case ChatInputNotificationActionKind.SwitchToModel:
        this._switchToModel(action.modelIdentifier);
        break;
    }
    if (!action.keepOpen) {
      this._notificationService.dismissNotification(notification.id);
    }
  }
  _switchToModel(modelIdentifier) {
    let switched = false;
    try {
      switched = this._delegate?.switchToModel?.(modelIdentifier) ?? false;
    } catch (error) {
      this._logActionError(error);
    }
    if (!switched) {
      this._openModelPicker();
    }
  }
  _openModelPicker() {
    try {
      this._delegate?.openModelPicker?.();
    } catch (error) {
      this._logActionError(error);
    }
  }
  _logActionError(error) {
    this._logService.error("[ChatInputNotificationWidget] Failed to execute notification action", error);
  }
  async _executeCommandAction(action) {
    this._telemetryService.publicLog2("workbenchActionExecuted", {
      id: action.commandId,
      from: "chatInputNotification"
    });
    await this._commandService.executeCommand(action.commandId, ...action.commandArgs ?? []);
  }
  _logShownTelemetry(notification) {
    const data = this._getTelemetryData(notification);
    if (this._lastShownTelemetryData?.id === data.id && this._lastShownTelemetryData.telemetryId === data.telemetryId) {
      return;
    }
    this._lastShownTelemetryData = data;
    this._telemetryService.publicLog2("chatInputNotificationShown", data);
  }
  _getTelemetryData(notification) {
    return {
      id: notification.id,
      telemetryId: notification.telemetryId
    };
  }
};
ChatInputNotificationWidget = __decorateClass([
  __decorateParam(1, IChatInputNotificationService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IMarkdownRendererService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, ILogService)
], ChatInputNotificationWidget);
export {
  ChatInputNotificationWidget
};
