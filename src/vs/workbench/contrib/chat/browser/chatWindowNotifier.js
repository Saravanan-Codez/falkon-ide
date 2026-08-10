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
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Disposable, DisposableResourceMap, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorunDelta, autorunIterableDelta } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { FocusMode } from "../../../../platform/native/common/native.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IChatService, IChatToolInvocation, ToolConfirmKind } from "../common/chatService/chatService.js";
import { migrateLegacyTerminalToolSpecificData } from "../common/chat.js";
import { ChatConfiguration, ChatNotificationMode } from "../common/constants.js";
import { IChatWidgetService } from "./chat.js";
let ChatWindowNotifier = class extends Disposable {
  constructor(_chatService, _chatWidgetService, _hostService, _configurationService) {
    super();
    this._chatService = _chatService;
    this._chatWidgetService = _chatWidgetService;
    this._hostService = _hostService;
    this._configurationService = _configurationService;
    this._activeNotifications = this._register(new DisposableResourceMap());
    const modelTrackers = this._register(new DisposableResourceMap());
    this._register(autorunIterableDelta(
      (reader) => this._chatService.chatModels.read(reader),
      ({ addedValues, removedValues }) => {
        for (const model of addedValues) {
          modelTrackers.set(model.sessionResource, this._trackModel(model));
        }
        for (const model of removedValues) {
          modelTrackers.deleteAndDispose(model.sessionResource);
        }
      }
    ));
  }
  static {
    this.ID = "workbench.contrib.chatWindowNotifier";
  }
  _trackModel(model) {
    return autorunDelta(model.requestNeedsInput, ({ lastValue, newValue }) => {
      const currentNeedsInput = !!newValue;
      const previousNeedsInput = !!lastValue;
      if (!previousNeedsInput && currentNeedsInput && newValue) {
        this._notifyIfNeeded(model.sessionResource, newValue);
      } else if (previousNeedsInput && !currentNeedsInput) {
        this._clearNotification(model.sessionResource);
      }
    });
  }
  async _notifyIfNeeded(sessionResource, info) {
    const mode = this._configurationService.getValue(ChatConfiguration.NotifyWindowOnConfirmation);
    if (mode === ChatNotificationMode.Off) {
      return;
    }
    const widget = this._chatWidgetService.getWidgetBySessionResource(sessionResource);
    const targetWindow = widget ? dom.getWindow(widget.domNode) : mainWindow;
    const isFocused = targetWindow.document.hasFocus();
    if (mode !== ChatNotificationMode.Always && isFocused) {
      return;
    }
    this._clearNotification(sessionResource);
    if (!isFocused) {
      await this._hostService.focus(targetWindow, { mode: FocusMode.Notify });
    }
    const notificationTitle = info.title ? localize("chatTitle", "Session: {0}", info.title) : localize("chat.untitledChat", "Untitled Session");
    const cts = new CancellationTokenSource();
    this._activeNotifications.set(sessionResource, toDisposable(() => cts.dispose(true)));
    const isQuestionCarousel = this._isQuestionCarouselPending(sessionResource);
    try {
      const actionLabel = isQuestionCarousel ? localize("openChatAction", "Open Session") : localize("allowAction", "Allow");
      const result = await this._hostService.showToast({
        title: this._sanitizeOSToastText(notificationTitle),
        body: this._getNotificationBody(sessionResource, info, isQuestionCarousel),
        actions: [actionLabel]
      }, cts.token);
      if (result.actionIndex === 0 && !isQuestionCarousel && this._confirmAllow(sessionResource)) {
        return;
      }
      if (result.clicked || typeof result.actionIndex === "number") {
        await this._hostService.focus(targetWindow, { mode: FocusMode.Force });
        const widget2 = await this._chatWidgetService.openSession(sessionResource);
        widget2?.focusInput();
      }
    } finally {
      this._clearNotification(sessionResource);
    }
  }
  _confirmAllow(sessionResource) {
    const model = this._chatService.getSession(sessionResource);
    const lastResponse = model?.lastRequest?.response;
    if (!lastResponse) {
      return false;
    }
    for (const part of lastResponse.response.value) {
      const state = part.kind === "toolInvocation" ? part.state.get() : void 0;
      if (state?.type === IChatToolInvocation.StateKind.WaitingForConfirmation || state?.type === IChatToolInvocation.StateKind.WaitingForPostApproval) {
        state.confirm({ type: ToolConfirmKind.UserAction });
        return true;
      }
    }
    return false;
  }
  _getNotificationBody(sessionResource, info, isQuestionCarousel) {
    if (isQuestionCarousel) {
      return localize("questionCarouselDetail", "Questions need your input.");
    }
    const terminalCommand = this._getPendingTerminalCommand(sessionResource);
    if (terminalCommand) {
      return this._sanitizeOSToastText(terminalCommand);
    }
    if (info.detail) {
      return this._sanitizeOSToastText(info.detail);
    }
    return localize("notificationDetail", "Approval needed to continue.");
  }
  _getPendingTerminalCommand(sessionResource) {
    const model = this._chatService.getSession(sessionResource);
    const lastResponse = model?.lastRequest?.response;
    if (!lastResponse?.response?.value) {
      return void 0;
    }
    for (const part of lastResponse.response.value) {
      if (part.kind === "toolInvocation" && part.toolSpecificData?.kind === "terminal") {
        const state = part.state.get();
        if (state?.type !== IChatToolInvocation.StateKind.WaitingForConfirmation && state?.type !== IChatToolInvocation.StateKind.WaitingForPostApproval) {
          continue;
        }
        const terminalData = migrateLegacyTerminalToolSpecificData(part.toolSpecificData);
        return terminalData.commandLine.forDisplay ?? terminalData.commandLine.userEdited ?? terminalData.commandLine.toolEdited ?? terminalData.commandLine.original;
      }
    }
    return void 0;
  }
  _isQuestionCarouselPending(sessionResource) {
    const model = this._chatService.getSession(sessionResource);
    const lastResponse = model?.lastRequest?.response;
    if (!lastResponse) {
      return false;
    }
    return lastResponse.response.value.some(
      (part) => part.kind === "questionCarousel" && !part.isUsed
    );
  }
  _sanitizeOSToastText(text) {
    return text.replace(/`/g, "'");
  }
  _clearNotification(sessionResource) {
    this._activeNotifications.deleteAndDispose(sessionResource);
  }
};
ChatWindowNotifier = __decorateClass([
  __decorateParam(0, IChatService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, IHostService),
  __decorateParam(3, IConfigurationService)
], ChatWindowNotifier);
export {
  ChatWindowNotifier
};
