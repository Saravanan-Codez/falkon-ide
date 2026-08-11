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
import { addDisposableListener, EventType } from "../../../../base/browser/dom.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { MOUSE_BACK_FORWARD_NAVIGATION_SETTING } from "../../../../workbench/services/history/common/history.js";
import { IWorkbenchLayoutService, Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
let SessionsMouseNavigationContribution = class extends Disposable {
  constructor(configurationService, layoutService, sessionsService) {
    super();
    this.configurationService = configurationService;
    this.layoutService = layoutService;
    this.sessionsService = sessionsService;
    const mouseNavigationListeners = this._register(new DisposableStore());
    this._register(Event.runAndSubscribe(this.layoutService.onDidAddContainer, ({ container, disposables }) => {
      const eventDisposables = disposables.add(new DisposableStore());
      eventDisposables.add(addDisposableListener(container, EventType.MOUSE_DOWN, (event) => this.handleMouseNavigation(event, true), true));
      eventDisposables.add(addDisposableListener(container, EventType.MOUSE_UP, (event) => this.handleMouseNavigation(event, false), true));
      mouseNavigationListeners.add(eventDisposables);
    }, { container: this.layoutService.mainContainer, disposables: this._store }));
  }
  static {
    this.ID = "workbench.contrib.sessionsMouseNavigation";
  }
  handleMouseNavigation(event, isMouseDown) {
    if (!this.configurationService.getValue(MOUSE_BACK_FORWARD_NAVIGATION_SETTING) || this.layoutService.hasFocus(Parts.EDITOR_PART)) {
      return;
    }
    if (event.button !== 3 && event.button !== 4) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (!isMouseDown) {
      return;
    }
    if (event.button === 3) {
      void this.sessionsService.openPreviousSession();
    } else {
      void this.sessionsService.openNextSession();
    }
  }
};
SessionsMouseNavigationContribution = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IWorkbenchLayoutService),
  __decorateParam(2, ISessionsService)
], SessionsMouseNavigationContribution);
export {
  SessionsMouseNavigationContribution
};
