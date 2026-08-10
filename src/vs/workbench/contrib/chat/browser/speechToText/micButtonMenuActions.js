import { addDisposableListener, getWindow } from "../../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { Separator, toAction } from "../../../../../base/common/actions.js";
import { localize } from "../../../../../nls.js";
import { createConfigureKeybindingAction } from "../../../../../platform/actions/common/menuService.js";
import { AgentsVoiceSettingId } from "../../../agentsVoice/common/agentsVoice.js";
import { CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID, CONFIGURE_VOICE_INSTRUCTIONS_ACTION_ID } from "../actions/configureVoiceInstructionsAction.js";
import { DictationSettingId } from "./chatSpeechToTextService.js";
import { SHOW_DICTATION_ONBOARDING_COMMAND } from "./dictationOnboarding.js";
const SELECT_MICROPHONE_COMMAND = "workbench.action.chat.selectSpeechToTextMicrophone";
const CANCEL_DICTATION_COMMAND = "workbench.action.chat.cancelSpeechToText";
const VOICE_DISCONNECT_COMMAND = "agentsVoice.disconnect";
const VOICE_OPEN_SETTINGS_COMMAND = "agentsVoice.openSettings";
const OPEN_SETTINGS_COMMAND = "workbench.action.openSettings";
const DICTATION_SETTINGS_QUERY = "dictation";
const SHOW_VOICE_MODE_ONBOARDING_COMMAND = "agentsVoice.showOnboarding";
const DICTATION_ENABLED_SETTING = "dictation.enabled";
const VOICE_ENABLED_SETTING = "agents.voice.enabled";
function createSelectMicrophoneAction(commandService) {
  return toAction({
    id: SELECT_MICROPHONE_COMMAND,
    label: localize("mic.selectMicrophone", "Select Microphone"),
    run: () => commandService.executeCommand(SELECT_MICROPHONE_COMMAND)
  });
}
function createDisableDictationAction(commandService, configurationService) {
  return toAction({
    id: "chat.dictation.disable",
    label: localize("dictation.disable", "Disable"),
    run: async () => {
      await commandService.executeCommand(CANCEL_DICTATION_COMMAND);
      await configurationService.updateValue(DICTATION_ENABLED_SETTING, false);
    }
  });
}
function createShowDictationOnboardingAction(commandService) {
  return toAction({
    id: SHOW_DICTATION_ONBOARDING_COMMAND,
    label: localize("dictation.showIntroduction", "Show Introduction"),
    run: () => commandService.executeCommand(SHOW_DICTATION_ONBOARDING_COMMAND)
  });
}
function createToggleButtonAction(configurationService, settingId, id, label) {
  const shown = configurationService.getValue(settingId) !== false;
  return toAction({
    id,
    label,
    checked: shown,
    run: () => configurationService.updateValue(settingId, !shown)
  });
}
function createDisableVoiceModeAction(commandService, configurationService) {
  return toAction({
    id: "chat.voiceMode.disable",
    label: localize("voiceMode.disable", "Disable"),
    run: async () => {
      await commandService.executeCommand(VOICE_DISCONNECT_COMMAND);
      await configurationService.updateValue(VOICE_ENABLED_SETTING, false);
    }
  });
}
function getDictationContextMenuActions(commandService, configurationService, keybindingService, keybindingCommandId) {
  return Separator.join(
    [
      createConfigureKeybindingAction(commandService, keybindingService, keybindingCommandId),
      createToggleButtonAction(configurationService, DictationSettingId.ShowButton, "chat.dictation.toggleButton", localize("dictation.microphoneButton", "Microphone Button")),
      createDisableDictationAction(commandService, configurationService)
    ],
    [
      createDictationSettingsAction(commandService),
      createConfigureInstructionsAction(commandService, CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID, localize("dictation.configureInstructions", "Configure Instructions")),
      createShowDictationOnboardingAction(commandService),
      createSelectMicrophoneAction(commandService)
    ]
  );
}
function createVoiceModeSettingsAction(commandService) {
  return toAction({
    id: VOICE_OPEN_SETTINGS_COMMAND,
    label: localize("voiceMode.openSettings", "Open Settings"),
    run: () => commandService.executeCommand(VOICE_OPEN_SETTINGS_COMMAND)
  });
}
function createDictationSettingsAction(commandService) {
  return toAction({
    id: "chat.dictation.openSettings",
    label: localize("dictation.openSettings", "Open Settings"),
    run: () => commandService.executeCommand(OPEN_SETTINGS_COMMAND, { query: DICTATION_SETTINGS_QUERY })
  });
}
function createShowVoiceModeOnboardingAction(commandService) {
  return toAction({
    id: SHOW_VOICE_MODE_ONBOARDING_COMMAND,
    label: localize("voiceMode.showIntroduction", "Show Introduction"),
    run: () => commandService.executeCommand(SHOW_VOICE_MODE_ONBOARDING_COMMAND)
  });
}
function createConfigureInstructionsAction(commandService, commandId, label) {
  return toAction({
    id: commandId,
    label,
    run: () => commandService.executeCommand(commandId)
  });
}
function getVoiceModeContextMenuActions(commandService, configurationService, keybindingService, keybindingCommandId) {
  return Separator.join(
    [
      createConfigureKeybindingAction(commandService, keybindingService, keybindingCommandId),
      createToggleButtonAction(configurationService, AgentsVoiceSettingId.ShowButton, "chat.voiceMode.toggleButton", localize("voiceMode.button", "Voice Mode Button")),
      createDisableVoiceModeAction(commandService, configurationService)
    ],
    [
      createVoiceModeSettingsAction(commandService),
      createConfigureInstructionsAction(commandService, CONFIGURE_VOICE_INSTRUCTIONS_ACTION_ID, localize("voiceMode.configureInstructions", "Configure Instructions")),
      createShowVoiceModeOnboardingAction(commandService),
      createSelectMicrophoneAction(commandService)
    ]
  );
}
function addMicButtonContextMenuListener(container, getActions, contextMenuService) {
  return addDisposableListener(container, "contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const event = new StandardMouseEvent(getWindow(container), e);
    contextMenuService.showContextMenu({
      getAnchor: () => event,
      getActions
    });
  });
}
export {
  SELECT_MICROPHONE_COMMAND,
  SHOW_VOICE_MODE_ONBOARDING_COMMAND,
  addMicButtonContextMenuListener,
  getDictationContextMenuActions,
  getVoiceModeContextMenuActions
};
