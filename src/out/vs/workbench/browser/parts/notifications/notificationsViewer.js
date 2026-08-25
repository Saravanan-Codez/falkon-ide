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
import { clearNode, addDisposableListener, EventType, EventHelper, $, isEventLike } from "../../../../base/browser/dom.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { ButtonBar } from "../../../../base/browser/ui/button/button.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { ActionRunner, Separator, toAction } from "../../../../base/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { dispose, DisposableStore, Disposable } from "../../../../base/common/lifecycle.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { NotificationViewItem, NotificationViewItemContentChangeKind, ChoiceAction, NotificationsSettings, getNotificationsPosition } from "../../../common/notifications.js";
import { ClearNotificationAction, ExpandNotificationAction, CollapseNotificationAction, ConfigureNotificationAction, getNotificationExpandIcon, getNotificationCollapseIcon } from "./notificationsActions.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ProgressBar } from "../../../../base/browser/ui/progressbar/progressbar.js";
import { INotificationService, NotificationsFilter, Severity, isNotificationSource } from "../../../../platform/notification/common/notification.js";
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { DropdownMenuActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { DomEmitter } from "../../../../base/browser/event.js";
import { Gesture, EventType as GestureEventType } from "../../../../base/browser/touch.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { defaultButtonStyles, defaultProgressBarStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
const DEFAULT_NOTIFICATION_ROW_HEIGHT = 42;
let notificationRowHeight = DEFAULT_NOTIFICATION_ROW_HEIGHT;
const onDidChangeNotificationRowHeightEmitter = new Emitter();
const onDidChangeNotificationRowHeight = onDidChangeNotificationRowHeightEmitter.event;
function setNotificationRowHeight(height) {
  if (height !== notificationRowHeight) {
    notificationRowHeight = height;
    onDidChangeNotificationRowHeightEmitter.fire(height);
  }
}
class NotificationsListDelegate {
  static get ROW_HEIGHT() {
    return notificationRowHeight;
  }
  static {
    this.LINE_HEIGHT = 22;
  }
  constructor(container) {
    this.offsetHelper = this.createOffsetHelper(container);
  }
  createOffsetHelper(container) {
    return container.appendChild($(".notification-offset-helper"));
  }
  getHeight(notification) {
    if (!notification.expanded) {
      return NotificationsListDelegate.ROW_HEIGHT;
    }
    let expandedHeight = NotificationsListDelegate.ROW_HEIGHT;
    const preferredMessageHeight = this.computePreferredHeight(notification);
    const messageOverflows = NotificationsListDelegate.LINE_HEIGHT < preferredMessageHeight;
    if (messageOverflows) {
      const overflow = preferredMessageHeight - NotificationsListDelegate.LINE_HEIGHT;
      expandedHeight += overflow;
    }
    if (notification.source || isNonEmptyArray(notification.actions?.primary)) {
      expandedHeight += NotificationsListDelegate.ROW_HEIGHT;
    }
    if (expandedHeight === NotificationsListDelegate.ROW_HEIGHT) {
      notification.collapse(
        true
        /* skip events, no change in height */
      );
    }
    return expandedHeight;
  }
  computePreferredHeight(notification) {
    let actions = 0;
    if (!notification.hasProgress) {
      actions++;
    }
    if (notification.canCollapse) {
      actions++;
    }
    if (isNonEmptyArray(notification.actions?.secondary)) {
      actions++;
    }
    this.offsetHelper.style.width = `${450 - (10 + 30 + actions * 30 - Math.max(actions - 1, 0) * 4)}px`;
    const renderedMessage = NotificationMessageRenderer.render(notification.message);
    this.offsetHelper.appendChild(renderedMessage);
    const preferredHeight = Math.max(this.offsetHelper.offsetHeight, this.offsetHelper.scrollHeight);
    clearNode(this.offsetHelper);
    return preferredHeight;
  }
  getTemplateId(element) {
    if (element instanceof NotificationViewItem) {
      return NotificationRenderer.TEMPLATE_ID;
    }
    throw new Error("unknown element type: " + element);
  }
}
class NotificationMessageRenderer {
  static render(message, actionHandler) {
    const messageContainer = $("span");
    for (const node of message.linkedText.nodes) {
      if (typeof node === "string") {
        messageContainer.appendChild(document.createTextNode(node));
      } else {
        let title = node.title;
        if (!title && node.href.startsWith("command:")) {
          title = localize("executeCommand", "Click to execute command '{0}'", node.href.substr("command:".length));
        } else if (!title) {
          title = node.href;
        }
        const anchor = $("a", { href: node.href, title, tabIndex: 0 }, node.label);
        if (actionHandler) {
          const handleOpen = (e) => {
            if (isEventLike(e)) {
              EventHelper.stop(e, true);
            }
            actionHandler.callback(node.href);
          };
          const onClick = actionHandler.toDispose.add(new DomEmitter(anchor, EventType.CLICK)).event;
          const onKeydown = actionHandler.toDispose.add(new DomEmitter(anchor, EventType.KEY_DOWN)).event;
          const onSpaceOrEnter = Event.chain(onKeydown, ($2) => $2.filter((e) => {
            const event = new StandardKeyboardEvent(e);
            return event.equals(KeyCode.Space) || event.equals(KeyCode.Enter);
          }));
          actionHandler.toDispose.add(Gesture.addTarget(anchor));
          const onTap = actionHandler.toDispose.add(new DomEmitter(anchor, GestureEventType.Tap)).event;
          Event.any(onClick, onTap, onSpaceOrEnter)(handleOpen, null, actionHandler.toDispose);
        }
        messageContainer.appendChild(anchor);
      }
    }
    return messageContainer;
  }
}
let NotificationRenderer = class {
  constructor(actionRunner, contextMenuService, instantiationService, notificationService) {
    this.actionRunner = actionRunner;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this.notificationService = notificationService;
  }
  static {
    this.TEMPLATE_ID = "notification";
  }
  get templateId() {
    return NotificationRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.toDispose = new DisposableStore();
    data.container = $(".notification-list-item");
    data.mainRow = $(".notification-list-item-main-row");
    data.icon = $(".notification-list-item-icon.codicon");
    data.message = $(".notification-list-item-message");
    const that = this;
    const toolbarContainer = $(".notification-list-item-toolbar-container");
    data.toolbar = new ActionBar(
      toolbarContainer,
      {
        ariaLabel: localize("notificationActions", "Notification Actions"),
        actionViewItemProvider: (action, options) => {
          if (action instanceof ConfigureNotificationAction) {
            return data.toDispose.add(new DropdownMenuActionViewItem(action, {
              getActions() {
                const actions = [];
                const source = { id: action.notification.sourceId, label: action.notification.source };
                if (isNotificationSource(source)) {
                  const isSourceFiltered = that.notificationService.getFilter(source) === NotificationsFilter.ERROR;
                  actions.push(toAction({
                    id: source.id,
                    label: isSourceFiltered ? localize("turnOnNotifications", "Turn On All Notifications from '{0}'", source.label) : localize("turnOffNotifications", "Turn Off Info and Warning Notifications from '{0}'", source.label),
                    run: () => that.notificationService.setFilter({ ...source, filter: isSourceFiltered ? NotificationsFilter.OFF : NotificationsFilter.ERROR })
                  }));
                  if (action.notification.actions?.secondary?.length) {
                    actions.push(new Separator());
                  }
                }
                if (Array.isArray(action.notification.actions?.secondary)) {
                  actions.push(...action.notification.actions.secondary);
                }
                return actions;
              }
            }, this.contextMenuService, {
              ...options,
              actionRunner: this.actionRunner,
              classNames: action.class
            }));
          }
          return void 0;
        },
        actionRunner: this.actionRunner
      }
    );
    data.toDispose.add(data.toolbar);
    data.detailsRow = $(".notification-list-item-details-row");
    data.source = $(".notification-list-item-source");
    data.buttonsContainer = $(".notification-list-item-buttons-container");
    container.appendChild(data.container);
    data.container.appendChild(data.detailsRow);
    data.detailsRow.appendChild(data.source);
    data.detailsRow.appendChild(data.buttonsContainer);
    data.container.appendChild(data.mainRow);
    data.mainRow.appendChild(data.icon);
    data.mainRow.appendChild(data.message);
    data.mainRow.appendChild(toolbarContainer);
    data.progress = new ProgressBar(container, defaultProgressBarStyles);
    data.toDispose.add(data.progress);
    data.renderer = this.instantiationService.createInstance(NotificationTemplateRenderer, data, this.actionRunner);
    data.toDispose.add(data.renderer);
    return data;
  }
  renderElement(notification, index, data) {
    data.renderer.setInput(notification);
  }
  disposeTemplate(templateData) {
    dispose(templateData.toDispose);
  }
};
NotificationRenderer = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, INotificationService)
], NotificationRenderer);
let NotificationTemplateRenderer = class extends Disposable {
  constructor(template, actionRunner, openerService, instantiationService, keybindingService, contextMenuService, hoverService, configurationService) {
    super();
    this.template = template;
    this.actionRunner = actionRunner;
    this.openerService = openerService;
    this.instantiationService = instantiationService;
    this.keybindingService = keybindingService;
    this.contextMenuService = contextMenuService;
    this.hoverService = hoverService;
    this.inputDisposables = this._register(new DisposableStore());
    if (!NotificationTemplateRenderer.closeNotificationAction) {
      NotificationTemplateRenderer.closeNotificationAction = instantiationService.createInstance(ClearNotificationAction, ClearNotificationAction.ID, ClearNotificationAction.LABEL);
      NotificationTemplateRenderer.expandNotificationAction = instantiationService.createInstance(ExpandNotificationAction, ExpandNotificationAction.ID, ExpandNotificationAction.LABEL);
      NotificationTemplateRenderer.collapseNotificationAction = instantiationService.createInstance(CollapseNotificationAction, CollapseNotificationAction.ID, CollapseNotificationAction.LABEL);
      NotificationTemplateRenderer.updateExpandCollapseIcons(configurationService);
    }
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotificationsSettings.NOTIFICATIONS_POSITION)) {
        NotificationTemplateRenderer.updateExpandCollapseIcons(configurationService);
      }
    }));
  }
  static updateExpandCollapseIcons(configurationService) {
    if (!NotificationTemplateRenderer.expandNotificationAction) {
      return;
    }
    const position = getNotificationsPosition(configurationService);
    NotificationTemplateRenderer.expandNotificationAction.class = ThemeIcon.asClassName(getNotificationExpandIcon(position));
    NotificationTemplateRenderer.collapseNotificationAction.class = ThemeIcon.asClassName(getNotificationCollapseIcon(position));
  }
  static {
    this.SEVERITIES = [Severity.Info, Severity.Warning, Severity.Error];
  }
  setInput(notification) {
    this.inputDisposables.clear();
    this.render(notification);
  }
  render(notification) {
    this.template.container.classList.toggle("expanded", notification.expanded);
    this.inputDisposables.add(addDisposableListener(this.template.container, EventType.MOUSE_UP, (e) => {
      if (e.button === 1) {
        EventHelper.stop(e, true);
      }
    }));
    this.inputDisposables.add(addDisposableListener(this.template.container, EventType.AUXCLICK, (e) => {
      if (!notification.hasProgress && e.button === 1) {
        EventHelper.stop(e, true);
        notification.close();
      }
    }));
    this.renderSeverity(notification);
    const messageCustomHover = this.inputDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.template.message, ""));
    const messageOverflows = this.renderMessage(notification, messageCustomHover);
    this.renderSecondaryActions(notification, messageOverflows);
    const sourceCustomHover = this.inputDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.template.source, ""));
    this.renderSource(notification, sourceCustomHover);
    this.renderButtons(notification);
    this.renderProgress(notification);
    this.inputDisposables.add(notification.onDidChangeContent((event) => {
      switch (event.kind) {
        case NotificationViewItemContentChangeKind.SEVERITY:
          this.renderSeverity(notification);
          break;
        case NotificationViewItemContentChangeKind.PROGRESS:
          this.renderProgress(notification);
          break;
        case NotificationViewItemContentChangeKind.MESSAGE:
          this.renderMessage(notification, messageCustomHover);
          break;
      }
    }));
  }
  renderSeverity(notification) {
    NotificationTemplateRenderer.SEVERITIES.forEach((severity) => {
      if (notification.severity !== severity) {
        this.template.icon.classList.remove(...ThemeIcon.asClassNameArray(this.toSeverityIcon(severity)));
      }
    });
    this.template.icon.classList.add(...ThemeIcon.asClassNameArray(this.toSeverityIcon(notification.severity)));
  }
  renderMessage(notification, customHover) {
    clearNode(this.template.message);
    this.template.message.appendChild(NotificationMessageRenderer.render(notification.message, {
      callback: (link) => this.openerService.open(URI.parse(link), { allowCommands: true }),
      toDispose: this.inputDisposables
    }));
    const messageOverflows = notification.canCollapse && !notification.expanded && this.template.message.scrollWidth > this.template.message.clientWidth;
    customHover.update(messageOverflows ? this.template.message.textContent + "" : "");
    return messageOverflows;
  }
  renderSecondaryActions(notification, messageOverflows) {
    const actions = [];
    if (isNonEmptyArray(notification.actions?.secondary)) {
      const configureNotificationAction = this.instantiationService.createInstance(ConfigureNotificationAction, ConfigureNotificationAction.ID, ConfigureNotificationAction.LABEL, notification);
      actions.push(configureNotificationAction);
      this.inputDisposables.add(configureNotificationAction);
    }
    let showExpandCollapseAction = false;
    if (notification.canCollapse) {
      if (notification.expanded) {
        showExpandCollapseAction = true;
      } else if (notification.source) {
        showExpandCollapseAction = true;
      } else if (messageOverflows) {
        showExpandCollapseAction = true;
      }
    }
    if (showExpandCollapseAction) {
      actions.push(notification.expanded ? NotificationTemplateRenderer.collapseNotificationAction : NotificationTemplateRenderer.expandNotificationAction);
    }
    if (!notification.hasProgress) {
      actions.push(NotificationTemplateRenderer.closeNotificationAction);
    }
    this.template.toolbar.clear();
    this.template.toolbar.context = notification;
    actions.forEach((action) => this.template.toolbar.push(action, { icon: true, label: false, keybinding: this.getKeybindingLabel(action) }));
  }
  renderSource(notification, sourceCustomHover) {
    if (notification.expanded && notification.source) {
      this.template.source.textContent = localize("notificationSource", "Source: {0}", notification.source);
      sourceCustomHover.update(notification.source);
    } else {
      this.template.source.textContent = "";
      sourceCustomHover.update("");
    }
  }
  renderButtons(notification) {
    clearNode(this.template.buttonsContainer);
    const primaryActions = notification.actions ? notification.actions.primary : void 0;
    if (notification.expanded && isNonEmptyArray(primaryActions)) {
      const that = this;
      const actionRunner = this.inputDisposables.add(new class extends ActionRunner {
        async runAction(action) {
          that.actionRunner.run(action, notification);
          if (!(action instanceof ChoiceAction) || !action.keepOpen) {
            notification.close();
          }
        }
      }());
      const buttonToolbar = this.inputDisposables.add(new ButtonBar(this.template.buttonsContainer));
      for (let i = 0; i < primaryActions.length; i++) {
        const action = primaryActions[i];
        const options = {
          title: true,
          // assign titles to buttons in case they overflow
          secondary: i > 0,
          ...defaultButtonStyles
        };
        const dropdownActions = action instanceof ChoiceAction ? action.menu : void 0;
        const button = this.inputDisposables.add(
          dropdownActions ? buttonToolbar.addButtonWithDropdown({
            ...options,
            contextMenuProvider: this.contextMenuService,
            actions: dropdownActions,
            actionRunner
          }) : buttonToolbar.addButton(options)
        );
        button.label = action.label;
        this.inputDisposables.add(button.onDidClick((e) => {
          if (e) {
            EventHelper.stop(e, true);
          }
          actionRunner.run(action);
        }));
      }
    }
  }
  renderProgress(notification) {
    if (!notification.hasProgress) {
      this.template.progress.stop().hide();
      return;
    }
    const state = notification.progress.state;
    if (state.infinite) {
      this.template.progress.infinite().show();
    } else if (typeof state.total === "number" || typeof state.worked === "number") {
      if (typeof state.total === "number" && !this.template.progress.hasTotal()) {
        this.template.progress.total(state.total);
      }
      if (typeof state.worked === "number") {
        this.template.progress.setWorked(state.worked).show();
      }
    } else {
      this.template.progress.done().hide();
    }
  }
  toSeverityIcon(severity) {
    switch (severity) {
      case Severity.Warning:
        return Codicon.warning;
      case Severity.Error:
        return Codicon.error;
    }
    return Codicon.info;
  }
  getKeybindingLabel(action) {
    const keybinding = this.keybindingService.lookupKeybinding(action.id);
    return keybinding ? keybinding.getLabel() : null;
  }
};
NotificationTemplateRenderer = __decorateClass([
  __decorateParam(2, IOpenerService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, IConfigurationService)
], NotificationTemplateRenderer);
export {
  DEFAULT_NOTIFICATION_ROW_HEIGHT,
  NotificationRenderer,
  NotificationTemplateRenderer,
  NotificationsListDelegate,
  onDidChangeNotificationRowHeight,
  setNotificationRowHeight
};
