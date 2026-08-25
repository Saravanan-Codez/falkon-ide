import { isLinux } from "../../../../base/common/platform.js";
import * as nls from "../../../../nls.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { defaultTerminalContribCommandsToSkipShell } from "../terminalContribExports.js";
const TERMINAL_VIEW_ID = "terminal";
const TERMINAL_CREATION_COMMANDS = ["workbench.action.terminal.toggleTerminal", "workbench.action.terminal.new", "workbench.action.togglePanel", "workbench.action.terminal.focus"];
const TERMINAL_CONFIG_SECTION = "terminal.integrated";
const DEFAULT_LETTER_SPACING = 0;
const MINIMUM_LETTER_SPACING = -5;
const DEFAULT_LINE_HEIGHT = isLinux ? 1.1 : 1;
const MINIMUM_FONT_WEIGHT = 1;
const MAXIMUM_FONT_WEIGHT = 1e3;
const DEFAULT_FONT_WEIGHT = "normal";
const DEFAULT_BOLD_FONT_WEIGHT = "bold";
const SUGGESTIONS_FONT_WEIGHT = ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
const ITerminalProfileResolverService = createDecorator("terminalProfileResolverService");
const ITerminalProfileService = createDecorator("terminalProfileService");
const isTerminalProcessManager = (t) => typeof t.write === "function";
var ProcessState = /* @__PURE__ */ ((ProcessState2) => {
  ProcessState2[ProcessState2["Uninitialized"] = 1] = "Uninitialized";
  ProcessState2[ProcessState2["Launching"] = 2] = "Launching";
  ProcessState2[ProcessState2["Running"] = 3] = "Running";
  ProcessState2[ProcessState2["KilledDuringLaunch"] = 4] = "KilledDuringLaunch";
  ProcessState2[ProcessState2["KilledByUser"] = 5] = "KilledByUser";
  ProcessState2[ProcessState2["KilledByProcess"] = 6] = "KilledByProcess";
  return ProcessState2;
})(ProcessState || {});
const QUICK_LAUNCH_PROFILE_CHOICE = "workbench.action.terminal.profile.choice";
var TerminalCommandId = /* @__PURE__ */ ((TerminalCommandId2) => {
  TerminalCommandId2["Toggle"] = "workbench.action.terminal.toggleTerminal";
  TerminalCommandId2["Kill"] = "workbench.action.terminal.kill";
  TerminalCommandId2["KillViewOrEditor"] = "workbench.action.terminal.killViewOrEditor";
  TerminalCommandId2["KillEditor"] = "workbench.action.terminal.killEditor";
  TerminalCommandId2["KillActiveTab"] = "workbench.action.terminal.killActiveTab";
  TerminalCommandId2["KillAll"] = "workbench.action.terminal.killAll";
  TerminalCommandId2["QuickKill"] = "workbench.action.terminal.quickKill";
  TerminalCommandId2["ConfigureTerminalSettings"] = "workbench.action.terminal.openSettings";
  TerminalCommandId2["ShellIntegrationLearnMore"] = "workbench.action.terminal.learnMore";
  TerminalCommandId2["CopyLastCommand"] = "workbench.action.terminal.copyLastCommand";
  TerminalCommandId2["CopyLastCommandOutput"] = "workbench.action.terminal.copyLastCommandOutput";
  TerminalCommandId2["CopyLastCommandAndLastCommandOutput"] = "workbench.action.terminal.copyLastCommandAndLastCommandOutput";
  TerminalCommandId2["CopyAndClearSelection"] = "workbench.action.terminal.copyAndClearSelection";
  TerminalCommandId2["CopySelection"] = "workbench.action.terminal.copySelection";
  TerminalCommandId2["CopySelectionAsHtml"] = "workbench.action.terminal.copySelectionAsHtml";
  TerminalCommandId2["SelectAll"] = "workbench.action.terminal.selectAll";
  TerminalCommandId2["DeleteWordLeft"] = "workbench.action.terminal.deleteWordLeft";
  TerminalCommandId2["DeleteWordRight"] = "workbench.action.terminal.deleteWordRight";
  TerminalCommandId2["DeleteToLineStart"] = "workbench.action.terminal.deleteToLineStart";
  TerminalCommandId2["MoveToLineStart"] = "workbench.action.terminal.moveToLineStart";
  TerminalCommandId2["MoveToLineEnd"] = "workbench.action.terminal.moveToLineEnd";
  TerminalCommandId2["New"] = "workbench.action.terminal.new";
  TerminalCommandId2["NewWithCwd"] = "workbench.action.terminal.newWithCwd";
  TerminalCommandId2["NewLocal"] = "workbench.action.terminal.newLocal";
  TerminalCommandId2["NewInActiveWorkspace"] = "workbench.action.terminal.newInActiveWorkspace";
  TerminalCommandId2["NewWithProfile"] = "workbench.action.terminal.newWithProfile";
  TerminalCommandId2["Split"] = "workbench.action.terminal.split";
  TerminalCommandId2["SplitActiveTab"] = "workbench.action.terminal.splitActiveTab";
  TerminalCommandId2["SplitInActiveWorkspace"] = "workbench.action.terminal.splitInActiveWorkspace";
  TerminalCommandId2["Unsplit"] = "workbench.action.terminal.unsplit";
  TerminalCommandId2["JoinActiveTab"] = "workbench.action.terminal.joinActiveTab";
  TerminalCommandId2["Join"] = "workbench.action.terminal.join";
  TerminalCommandId2["Relaunch"] = "workbench.action.terminal.relaunch";
  TerminalCommandId2["FocusPreviousPane"] = "workbench.action.terminal.focusPreviousPane";
  TerminalCommandId2["CreateTerminalEditor"] = "workbench.action.createTerminalEditor";
  TerminalCommandId2["CreateTerminalEditorSameGroup"] = "workbench.action.createTerminalEditorSameGroup";
  TerminalCommandId2["CreateTerminalEditorSide"] = "workbench.action.createTerminalEditorSide";
  TerminalCommandId2["FocusTabs"] = "workbench.action.terminal.focusTabs";
  TerminalCommandId2["FocusNextPane"] = "workbench.action.terminal.focusNextPane";
  TerminalCommandId2["ResizePaneLeft"] = "workbench.action.terminal.resizePaneLeft";
  TerminalCommandId2["ResizePaneRight"] = "workbench.action.terminal.resizePaneRight";
  TerminalCommandId2["ResizePaneUp"] = "workbench.action.terminal.resizePaneUp";
  TerminalCommandId2["SizeToContentWidth"] = "workbench.action.terminal.sizeToContentWidth";
  TerminalCommandId2["SizeToContentWidthActiveTab"] = "workbench.action.terminal.sizeToContentWidthActiveTab";
  TerminalCommandId2["ResizePaneDown"] = "workbench.action.terminal.resizePaneDown";
  TerminalCommandId2["Focus"] = "workbench.action.terminal.focus";
  TerminalCommandId2["FocusInstance"] = "workbench.action.terminal.focusInstance";
  TerminalCommandId2["FocusNext"] = "workbench.action.terminal.focusNext";
  TerminalCommandId2["FocusPrevious"] = "workbench.action.terminal.focusPrevious";
  TerminalCommandId2["Paste"] = "workbench.action.terminal.paste";
  TerminalCommandId2["PastePwsh"] = "workbench.action.terminal.pastePwsh";
  TerminalCommandId2["PasteSelection"] = "workbench.action.terminal.pasteSelection";
  TerminalCommandId2["SelectDefaultProfile"] = "workbench.action.terminal.selectDefaultShell";
  TerminalCommandId2["RunSelectedText"] = "workbench.action.terminal.runSelectedText";
  TerminalCommandId2["RunActiveFile"] = "workbench.action.terminal.runActiveFile";
  TerminalCommandId2["SwitchTerminal"] = "workbench.action.terminal.switchTerminal";
  TerminalCommandId2["ScrollDownLine"] = "workbench.action.terminal.scrollDown";
  TerminalCommandId2["ScrollDownPage"] = "workbench.action.terminal.scrollDownPage";
  TerminalCommandId2["ScrollToBottom"] = "workbench.action.terminal.scrollToBottom";
  TerminalCommandId2["ScrollUpLine"] = "workbench.action.terminal.scrollUp";
  TerminalCommandId2["ScrollUpPage"] = "workbench.action.terminal.scrollUpPage";
  TerminalCommandId2["ScrollToTop"] = "workbench.action.terminal.scrollToTop";
  TerminalCommandId2["Clear"] = "workbench.action.terminal.clear";
  TerminalCommandId2["ClearSelection"] = "workbench.action.terminal.clearSelection";
  TerminalCommandId2["ChangeIcon"] = "workbench.action.terminal.changeIcon";
  TerminalCommandId2["ChangeIconActiveTab"] = "workbench.action.terminal.changeIconActiveTab";
  TerminalCommandId2["ChangeColor"] = "workbench.action.terminal.changeColor";
  TerminalCommandId2["ChangeColorActiveTab"] = "workbench.action.terminal.changeColorActiveTab";
  TerminalCommandId2["Rename"] = "workbench.action.terminal.rename";
  TerminalCommandId2["RenameActiveTab"] = "workbench.action.terminal.renameActiveTab";
  TerminalCommandId2["RenameWithArgs"] = "workbench.action.terminal.renameWithArg";
  TerminalCommandId2["ScrollToPreviousCommand"] = "workbench.action.terminal.scrollToPreviousCommand";
  TerminalCommandId2["ScrollToNextCommand"] = "workbench.action.terminal.scrollToNextCommand";
  TerminalCommandId2["SelectToPreviousCommand"] = "workbench.action.terminal.selectToPreviousCommand";
  TerminalCommandId2["SelectToNextCommand"] = "workbench.action.terminal.selectToNextCommand";
  TerminalCommandId2["SelectToPreviousLine"] = "workbench.action.terminal.selectToPreviousLine";
  TerminalCommandId2["SelectToNextLine"] = "workbench.action.terminal.selectToNextLine";
  TerminalCommandId2["SendSequence"] = "workbench.action.terminal.sendSequence";
  TerminalCommandId2["SendSignal"] = "workbench.action.terminal.sendSignal";
  TerminalCommandId2["AttachToSession"] = "workbench.action.terminal.attachToSession";
  TerminalCommandId2["DetachSession"] = "workbench.action.terminal.detachSession";
  TerminalCommandId2["MoveToEditor"] = "workbench.action.terminal.moveToEditor";
  TerminalCommandId2["MoveToTerminalPanel"] = "workbench.action.terminal.moveToTerminalPanel";
  TerminalCommandId2["MoveIntoNewWindow"] = "workbench.action.terminal.moveIntoNewWindow";
  TerminalCommandId2["NewInNewWindow"] = "workbench.action.terminal.newInNewWindow";
  TerminalCommandId2["SetDimensions"] = "workbench.action.terminal.setDimensions";
  TerminalCommandId2["FocusHover"] = "workbench.action.terminal.focusHover";
  TerminalCommandId2["ShowEnvironmentContributions"] = "workbench.action.terminal.showEnvironmentContributions";
  TerminalCommandId2["StartVoice"] = "workbench.action.terminal.startVoice";
  TerminalCommandId2["StopVoice"] = "workbench.action.terminal.stopVoice";
  TerminalCommandId2["RevealCommand"] = "workbench.action.terminal.revealCommand";
  return TerminalCommandId2;
})(TerminalCommandId || {});
const DEFAULT_COMMANDS_TO_SKIP_SHELL = [
  "workbench.action.terminal.clearSelection" /* ClearSelection */,
  "workbench.action.terminal.clear" /* Clear */,
  "workbench.action.terminal.copyAndClearSelection" /* CopyAndClearSelection */,
  "workbench.action.terminal.copySelection" /* CopySelection */,
  "workbench.action.terminal.copySelectionAsHtml" /* CopySelectionAsHtml */,
  "workbench.action.terminal.copyLastCommand" /* CopyLastCommand */,
  "workbench.action.terminal.copyLastCommandOutput" /* CopyLastCommandOutput */,
  "workbench.action.terminal.copyLastCommandAndLastCommandOutput" /* CopyLastCommandAndLastCommandOutput */,
  "workbench.action.terminal.deleteToLineStart" /* DeleteToLineStart */,
  "workbench.action.terminal.deleteWordLeft" /* DeleteWordLeft */,
  "workbench.action.terminal.deleteWordRight" /* DeleteWordRight */,
  "workbench.action.terminal.focusNextPane" /* FocusNextPane */,
  "workbench.action.terminal.focusNext" /* FocusNext */,
  "workbench.action.terminal.focusPreviousPane" /* FocusPreviousPane */,
  "workbench.action.terminal.focusPrevious" /* FocusPrevious */,
  "workbench.action.terminal.focus" /* Focus */,
  "workbench.action.terminal.sizeToContentWidth" /* SizeToContentWidth */,
  "workbench.action.terminal.kill" /* Kill */,
  "workbench.action.terminal.killEditor" /* KillEditor */,
  "workbench.action.terminal.moveToEditor" /* MoveToEditor */,
  "workbench.action.terminal.moveToLineEnd" /* MoveToLineEnd */,
  "workbench.action.terminal.moveToLineStart" /* MoveToLineStart */,
  "workbench.action.terminal.moveToTerminalPanel" /* MoveToTerminalPanel */,
  "workbench.action.terminal.newInActiveWorkspace" /* NewInActiveWorkspace */,
  "workbench.action.terminal.new" /* New */,
  "workbench.action.terminal.newInNewWindow" /* NewInNewWindow */,
  "workbench.action.terminal.paste" /* Paste */,
  "workbench.action.terminal.pastePwsh" /* PastePwsh */,
  "workbench.action.terminal.pasteSelection" /* PasteSelection */,
  "workbench.action.terminal.resizePaneDown" /* ResizePaneDown */,
  "workbench.action.terminal.resizePaneLeft" /* ResizePaneLeft */,
  "workbench.action.terminal.resizePaneRight" /* ResizePaneRight */,
  "workbench.action.terminal.resizePaneUp" /* ResizePaneUp */,
  "workbench.action.terminal.runActiveFile" /* RunActiveFile */,
  "workbench.action.terminal.runSelectedText" /* RunSelectedText */,
  "workbench.action.terminal.scrollDown" /* ScrollDownLine */,
  "workbench.action.terminal.scrollDownPage" /* ScrollDownPage */,
  "workbench.action.terminal.scrollToBottom" /* ScrollToBottom */,
  "workbench.action.terminal.scrollToNextCommand" /* ScrollToNextCommand */,
  "workbench.action.terminal.scrollToPreviousCommand" /* ScrollToPreviousCommand */,
  "workbench.action.terminal.scrollToTop" /* ScrollToTop */,
  "workbench.action.terminal.scrollUp" /* ScrollUpLine */,
  "workbench.action.terminal.scrollUpPage" /* ScrollUpPage */,
  "workbench.action.terminal.sendSequence" /* SendSequence */,
  "workbench.action.terminal.selectAll" /* SelectAll */,
  "workbench.action.terminal.selectToNextCommand" /* SelectToNextCommand */,
  "workbench.action.terminal.selectToNextLine" /* SelectToNextLine */,
  "workbench.action.terminal.selectToPreviousCommand" /* SelectToPreviousCommand */,
  "workbench.action.terminal.selectToPreviousLine" /* SelectToPreviousLine */,
  "workbench.action.terminal.splitInActiveWorkspace" /* SplitInActiveWorkspace */,
  "workbench.action.terminal.split" /* Split */,
  "workbench.action.terminal.toggleTerminal" /* Toggle */,
  "workbench.action.terminal.focusHover" /* FocusHover */,
  AccessibilityCommandId.OpenAccessibilityHelp,
  "workbench.action.terminal.stopVoice" /* StopVoice */,
  "workbench.action.terminal.sendSignal" /* SendSignal */,
  "workbench.action.tasks.rerunForActiveTerminal",
  "editor.action.toggleTabFocusMode",
  "notifications.hideList",
  "notifications.hideToasts",
  "workbench.action.closeQuickOpen",
  "workbench.action.quickOpen",
  "workbench.action.quickOpenPreviousEditor",
  "workbench.action.showCommands",
  "workbench.action.tasks.build",
  "workbench.action.tasks.restartTask",
  "workbench.action.tasks.runTask",
  "workbench.action.tasks.reRunTask",
  "workbench.action.tasks.showLog",
  "workbench.action.tasks.showTasks",
  "workbench.action.tasks.terminate",
  "workbench.action.tasks.test",
  "workbench.action.toggleFullScreen",
  "workbench.action.terminal.focusAtIndex1",
  "workbench.action.terminal.focusAtIndex2",
  "workbench.action.terminal.focusAtIndex3",
  "workbench.action.terminal.focusAtIndex4",
  "workbench.action.terminal.focusAtIndex5",
  "workbench.action.terminal.focusAtIndex6",
  "workbench.action.terminal.focusAtIndex7",
  "workbench.action.terminal.focusAtIndex8",
  "workbench.action.terminal.focusAtIndex9",
  "workbench.action.focusSecondEditorGroup",
  "workbench.action.focusThirdEditorGroup",
  "workbench.action.focusFourthEditorGroup",
  "workbench.action.focusFifthEditorGroup",
  "workbench.action.focusSixthEditorGroup",
  "workbench.action.focusSeventhEditorGroup",
  "workbench.action.focusEighthEditorGroup",
  "workbench.action.focusNextPart",
  "workbench.action.focusPreviousPart",
  "workbench.action.nextPanelView",
  "workbench.action.previousPanelView",
  "workbench.action.nextSideBarView",
  "workbench.action.previousSideBarView",
  "workbench.action.debug.disconnect",
  "workbench.action.debug.start",
  "workbench.action.debug.stop",
  "workbench.action.debug.run",
  "workbench.action.debug.restart",
  "workbench.action.debug.continue",
  "workbench.action.debug.pause",
  "workbench.action.debug.stepInto",
  "workbench.action.debug.stepOut",
  "workbench.action.debug.stepOver",
  "sessions.goBack",
  "sessions.goForward",
  "sessions.focusActiveSession",
  "sessions.focusSessionInGrid1",
  "sessions.focusSessionInGrid2",
  "sessions.focusSessionInGrid3",
  "sessions.focusSessionInGrid4",
  "sessions.focusSessionInGrid5",
  "sessions.focusSessionInGrid6",
  "sessions.focusSessionInGrid7",
  "sessions.focusSessionInGrid8",
  "sessions.focusSessionInGrid9",
  "sessionsViewPane.navigatePreviousSession",
  "sessionsViewPane.navigateNextSession",
  "workbench.action.nextEditor",
  "workbench.action.previousEditor",
  "workbench.action.nextEditorInGroup",
  "workbench.action.previousEditorInGroup",
  "workbench.action.openNextRecentlyUsedEditor",
  "workbench.action.openPreviousRecentlyUsedEditor",
  "workbench.action.openNextRecentlyUsedEditorInGroup",
  "workbench.action.openPreviousRecentlyUsedEditorInGroup",
  "workbench.action.quickOpenPreviousRecentlyUsedEditor",
  "workbench.action.quickOpenLeastRecentlyUsedEditor",
  "workbench.action.quickOpenPreviousRecentlyUsedEditorInGroup",
  "workbench.action.quickOpenLeastRecentlyUsedEditorInGroup",
  "workbench.action.focusActiveEditorGroup",
  "workbench.action.focusFirstEditorGroup",
  "workbench.action.focusLastEditorGroup",
  "workbench.action.firstEditorInGroup",
  "workbench.action.lastEditorInGroup",
  "workbench.action.navigateUp",
  "workbench.action.navigateDown",
  "workbench.action.navigateRight",
  "workbench.action.navigateLeft",
  "workbench.action.togglePanel",
  "workbench.action.quickOpenView",
  "workbench.action.toggleMaximizedPanel",
  "workbench.action.zoomIn",
  "workbench.action.zoomOut",
  "workbench.action.zoomReset",
  "notification.acceptPrimaryAction",
  "runCommands",
  "workbench.action.terminal.chat.start",
  "workbench.action.terminal.chat.close",
  "workbench.action.terminal.chat.discard",
  "workbench.action.terminal.chat.makeRequest",
  "workbench.action.terminal.chat.cancel",
  "workbench.action.terminal.chat.feedbackHelpful",
  "workbench.action.terminal.chat.feedbackUnhelpful",
  "workbench.action.terminal.chat.feedbackReportIssue",
  "workbench.action.terminal.chat.runCommand",
  "workbench.action.terminal.chat.insertCommand",
  "workbench.action.terminal.chat.viewInChat",
  ...defaultTerminalContribCommandsToSkipShell
];
const terminalContributionsDescriptor = {
  extensionPoint: "terminal",
  defaultExtensionKind: ["workspace"],
  activationEventsGenerator: function* (contribs) {
    for (const contrib of contribs) {
      for (const profileContrib of contrib.profiles ?? []) {
        yield `onTerminalProfile:${profileContrib.id}`;
      }
    }
  },
  jsonSchema: {
    description: nls.localize("vscode.extension.contributes.terminal", "Contributes terminal functionality."),
    type: "object",
    properties: {
      profiles: {
        type: "array",
        description: nls.localize("vscode.extension.contributes.terminal.profiles", "Defines additional terminal profiles that the user can create."),
        items: {
          type: "object",
          required: ["id", "title"],
          defaultSnippets: [{
            body: {
              id: "$1",
              title: "$2"
            }
          }],
          properties: {
            id: {
              description: nls.localize("vscode.extension.contributes.terminal.profiles.id", "The ID of the terminal profile provider."),
              type: "string"
            },
            title: {
              description: nls.localize("vscode.extension.contributes.terminal.profiles.title", "Title for this terminal profile."),
              type: "string"
            },
            icon: {
              description: nls.localize("vscode.extension.contributes.terminal.types.icon", "A codicon, URI, or light and dark URIs to associate with this terminal type."),
              anyOf: [
                {
                  type: "string"
                },
                {
                  type: "object",
                  properties: {
                    light: {
                      description: nls.localize("vscode.extension.contributes.terminal.types.icon.light", "Icon path when a light theme is used"),
                      type: "string"
                    },
                    dark: {
                      description: nls.localize("vscode.extension.contributes.terminal.types.icon.dark", "Icon path when a dark theme is used"),
                      type: "string"
                    }
                  }
                }
              ]
            },
            titleTemplate: {
              description: nls.localize("vscode.extension.contributes.terminal.profiles.titleTemplate", "A title template string for the terminal tab. Supports variables like ${sequence}, ${process}, ${cwd}, etc. Overrides the default terminal.integrated.tabs.title setting for terminals created with this profile."),
              type: "string"
            }
          }
        }
      },
      completionProviders: {
        type: "array",
        description: nls.localize("vscode.extension.contributes.terminal.completionProviders", "Defines terminal completion providers that will be registered when the extension activates."),
        items: {
          type: "object",
          required: ["id"],
          defaultSnippets: [{
            body: {
              id: "$1",
              description: "$2"
            }
          }],
          properties: {
            description: {
              description: nls.localize("vscode.extension.contributes.terminal.completionProviders.description", "A description of what the completion provider does. This will be shown in the settings UI."),
              type: "string"
            }
          }
        }
      }
    }
  }
};
export {
  DEFAULT_BOLD_FONT_WEIGHT,
  DEFAULT_COMMANDS_TO_SKIP_SHELL,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_LETTER_SPACING,
  DEFAULT_LINE_HEIGHT,
  ITerminalProfileResolverService,
  ITerminalProfileService,
  MAXIMUM_FONT_WEIGHT,
  MINIMUM_FONT_WEIGHT,
  MINIMUM_LETTER_SPACING,
  ProcessState,
  QUICK_LAUNCH_PROFILE_CHOICE,
  SUGGESTIONS_FONT_WEIGHT,
  TERMINAL_CONFIG_SECTION,
  TERMINAL_CREATION_COMMANDS,
  TERMINAL_VIEW_ID,
  TerminalCommandId,
  isTerminalProcessManager,
  terminalContributionsDescriptor
};
