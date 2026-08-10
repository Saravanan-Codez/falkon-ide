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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, derivedOpts, observableFromEvent, observableValue } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { MenuId, MenuItemAction, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { SegmentedVoiceInputModePillInactive } from "../../../../workbench/contrib/chat/browser/voiceInputMode/voiceInputModeContextKeys.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService, createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { IMicCaptureService } from "../../../../workbench/contrib/chat/browser/voiceClient/micCaptureService.js";
import { ITtsPlaybackService } from "../../../../workbench/contrib/chat/browser/voiceClient/ttsPlaybackService.js";
import { IVoiceSessionController } from "../../../../workbench/contrib/chat/browser/voiceClient/voiceSessionController.js";
import { AgentsVoiceSettingId, AGENTS_VOICE_ENABLED } from "../../../../workbench/contrib/agentsVoice/common/agentsVoice.js";
import { IChatWidgetService } from "../../../../workbench/contrib/chat/browser/chat.js";
import { VoiceModeActionViewItem } from "../../../../workbench/contrib/chat/browser/voiceClient/voiceModeActionViewItem.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { setupVoiceInputDecorations } from "./voiceInputDecorations.js";
const NEW_CHAT_VOICE_SENTINEL = URI.from({ scheme: "sessions-voice", authority: "new-chat", path: "/composer" });
function isNewChatVoiceSessionActive(connected, connecting, targetSession, hasDraftTarget) {
  return (connected || connecting) && targetSession === void 0 && hasDraftTarget;
}
const INewChatVoiceTargetService = createDecorator("newChatVoiceTargetService");
let NewChatVoiceTargetService = class extends Disposable {
  constructor(sessionsService, chatWidgetService) {
    super();
    this.sessionsService = sessionsService;
    this.chatWidgetService = chatWidgetService;
    this._composers = /* @__PURE__ */ new Set();
    this._activeComposer = observableValue(this, void 0);
    this.activeComposer = this._activeComposer;
    this._focusedSessionResource = observableFromEvent(
      this,
      this.chatWidgetService.onDidChangeFocusedSession,
      () => this.chatWidgetService.lastFocusedWidget?.viewModel?.sessionResource
    );
    this.currentVoiceInputResource = derivedOpts({ owner: this, equalsFn: isEqual }, (reader) => {
      const composer = this._activeComposer.read(reader);
      const active = this.sessionsService.activeSession.read(reader);
      const created = active?.isCreated.read(reader) ? active.activeChat.read(reader)?.resource : void 0;
      if (composer && (composer.routesWhileSessionActive || !created)) {
        return NEW_CHAT_VOICE_SENTINEL;
      }
      if (created) {
        return created;
      }
      return this._focusedSessionResource.read(reader);
    });
  }
  registerComposer(composer) {
    this._composers.add(composer);
    this._activeComposer.set(composer, void 0);
    return toDisposable(() => {
      this._composers.delete(composer);
      if (this._activeComposer.get() === composer) {
        const remaining = [...this._composers];
        this._activeComposer.set(remaining.length ? remaining[remaining.length - 1] : void 0, void 0);
      }
    });
  }
  setActive(composer) {
    if (this._composers.has(composer)) {
      this._activeComposer.set(composer, void 0);
    }
  }
};
NewChatVoiceTargetService = __decorateClass([
  __decorateParam(0, ISessionsService),
  __decorateParam(1, IChatWidgetService)
], NewChatVoiceTargetService);
registerSingleton(INewChatVoiceTargetService, NewChatVoiceTargetService, InstantiationType.Delayed);
const SessionsNewChatVoiceMenu = new MenuId("SessionsNewChatVoiceMenu");
const WHEN_VOICE_ENABLED = AGENTS_VOICE_ENABLED;
const WHEN_VOICE_BUTTON_SHOWN = ContextKeyExpr.notEquals(`config.${AgentsVoiceSettingId.ShowButton}`, false);
const WHEN_CONNECTING = ContextKeyExpr.equals("agentsVoiceConnecting", true);
const WHEN_LISTENING = ContextKeyExpr.equals("agentsVoiceListening", true);
const WHEN_CONNECTED = ContextKeyExpr.equals("agentsVoiceConnected", true);
const WHEN_INITIATED_HERE = ContextKeyExpr.equals("agentsVoiceInitiatedHere", true);
const WHEN_VOICE_SURFACE = ContextKeyExpr.equals("newChatVoiceSurface", true);
const WHEN_NOT_DICTATING = ContextKeyExpr.and(
  ContextKeyExpr.has("chatSpeechToTextRecording").negate(),
  ContextKeyExpr.has("chatSpeechToTextPreparing").negate()
);
const WHEN_NO_SEGMENTED_PILL = SegmentedVoiceInputModePillInactive;
MenuRegistry.appendMenuItem(SessionsNewChatVoiceMenu, {
  command: { id: "agentsVoice.connecting", title: localize("agentsVoice.connecting", "Connecting..."), icon: Codicon.loadingCompact },
  when: ContextKeyExpr.and(WHEN_VOICE_ENABLED, WHEN_VOICE_BUTTON_SHOWN, WHEN_CONNECTING, WHEN_INITIATED_HERE, WHEN_NO_SEGMENTED_PILL),
  group: "navigation",
  order: -10
});
MenuRegistry.appendMenuItem(SessionsNewChatVoiceMenu, {
  command: { id: "agentsVoice.startVoiceInChat", title: localize("agentsVoice.startVoiceInChat", "Voice Mode"), icon: Codicon.voiceModeCompact },
  when: ContextKeyExpr.and(WHEN_VOICE_ENABLED, WHEN_VOICE_BUTTON_SHOWN, WHEN_VOICE_SURFACE, WHEN_LISTENING.negate(), WHEN_CONNECTING.negate(), WHEN_NOT_DICTATING, WHEN_NO_SEGMENTED_PILL),
  group: "navigation",
  order: -10
});
MenuRegistry.appendMenuItem(SessionsNewChatVoiceMenu, {
  command: { id: "agentsVoice.pttStopInChat", title: localize("agentsVoice.pttStopInChat", "Voice Mode: Stop Recording"), icon: Codicon.voiceModeCompact },
  when: ContextKeyExpr.and(WHEN_VOICE_ENABLED, WHEN_VOICE_BUTTON_SHOWN, WHEN_LISTENING, WHEN_INITIATED_HERE, WHEN_NO_SEGMENTED_PILL),
  group: "navigation",
  order: -10
});
MenuRegistry.appendMenuItem(SessionsNewChatVoiceMenu, {
  command: { id: "agentsVoice.openSettings", title: localize("agentsVoice.openSettings", "Voice Mode Settings"), icon: Codicon.settingsGear },
  when: ContextKeyExpr.and(WHEN_VOICE_ENABLED, WHEN_VOICE_BUTTON_SHOWN, WHEN_CONNECTED, WHEN_INITIATED_HERE, WHEN_NO_SEGMENTED_PILL),
  group: "navigation",
  order: -9.5
});
MenuRegistry.appendMenuItem(SessionsNewChatVoiceMenu, {
  command: { id: "agentsVoice.disconnect", title: localize("agentsVoice.disconnect", "Disconnect Voice Mode"), icon: Codicon.debugDisconnectCompact },
  when: ContextKeyExpr.and(WHEN_VOICE_ENABLED, WHEN_VOICE_BUTTON_SHOWN, WHEN_CONNECTED, WHEN_INITIATED_HERE, WHEN_NO_SEGMENTED_PILL),
  group: "navigation",
  order: -9
});
let NewChatVoiceController = class extends Disposable {
  constructor(options, instantiationService, contextKeyService, targetService, voiceSessionController, sessionsService, ttsPlaybackService, micCaptureService, configurationService, keybindingService, themeService, accessibilityService) {
    super();
    this._register(targetService.registerComposer(options.composer));
    this._register(options.composer.onDidFocus(() => targetService.setActive(options.composer)));
    const scopedContextKeyService = this._register(contextKeyService.createScoped(options.toolbarContainer));
    const voiceSurfaceKey = scopedContextKeyService.createKey("newChatVoiceSurface", false);
    const initiatedHereKey = scopedContextKeyService.createKey("agentsVoiceInitiatedHere", false);
    const scopedInstantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, scopedContextKeyService])));
    const toolbar = this._register(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, options.toolbarContainer, SessionsNewChatVoiceMenu, {
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      actionViewItemProvider: (action, itemOptions) => {
        if ((action.id === "agentsVoice.startVoiceInChat" || action.id === "agentsVoice.pttStopInChat") && action instanceof MenuItemAction) {
          return scopedInstantiationService.createInstance(VoiceModeActionViewItem, action, itemOptions);
        }
        return void 0;
      }
    }));
    if (options.onDidChangeActions) {
      const onDidChangeActions = () => {
        let actionCount = 0;
        while (toolbar.getItemAction(actionCount)) {
          actionCount++;
        }
        options.onDidChangeActions?.(actionCount);
      };
      this._register(toolbar.onDidChangeMenuItems(onDidChangeActions));
      onDidChangeActions();
    }
    const isVoiceSurface = derived((reader) => {
      const active = sessionsService.activeSession.read(reader);
      const hasCreatedSession = !!active && active.isCreated.read(reader);
      const isActiveComposer = targetService.activeComposer.read(reader) === options.composer;
      return (options.composer.routesWhileSessionActive || !hasCreatedSession) && isActiveComposer;
    });
    const isVoiceTarget = derived((reader) => {
      const voiceActive = isNewChatVoiceSessionActive(
        voiceSessionController.isConnected.read(reader),
        voiceSessionController.isConnecting.read(reader),
        voiceSessionController.targetSession.read(reader),
        voiceSessionController.hasDraftTarget.read(reader)
      );
      return voiceActive && isVoiceSurface.read(reader);
    });
    this._register(autorun((reader) => {
      voiceSurfaceKey.set(isVoiceSurface.read(reader));
      initiatedHereKey.set(isVoiceTarget.read(reader));
    }));
    this._register(setupVoiceInputDecorations({
      voiceSessionController,
      ttsPlaybackService,
      micCaptureService,
      configurationService,
      keybindingService,
      themeService,
      accessibilityService
    }, {
      inputContainer: options.inputContainer,
      isActive: isVoiceTarget,
      getCurrentResource: () => NEW_CHAT_VOICE_SENTINEL,
      currentVoiceInputResource: targetService.currentVoiceInputResource
    }));
  }
};
NewChatVoiceController = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, INewChatVoiceTargetService),
  __decorateParam(4, IVoiceSessionController),
  __decorateParam(5, ISessionsService),
  __decorateParam(6, ITtsPlaybackService),
  __decorateParam(7, IMicCaptureService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, IThemeService),
  __decorateParam(11, IAccessibilityService)
], NewChatVoiceController);
export {
  INewChatVoiceTargetService,
  NEW_CHAT_VOICE_SENTINEL,
  NewChatVoiceController,
  NewChatVoiceTargetService,
  SessionsNewChatVoiceMenu,
  isNewChatVoiceSessionActive
};
