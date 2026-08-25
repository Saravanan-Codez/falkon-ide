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
import { renderAsPlaintext } from "../../../../../base/browser/markdownRenderer.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { getChatSessionArchiveActionPresentation, getChatSessionArchiveActionWording } from "../../../../../platform/chat/common/sessionArchiveActions.js";
import { openSession } from "./agentSessionsOpener.js";
import { isAgentHostAgentSessionItem, isLocalAgentSessionItem } from "./agentSessionsModel.js";
import { IAgentSessionsService } from "./agentSessionsService.js";
import { AgentSessionsSorter, groupAgentSessionsByDate, sessionDateFromNow } from "./agentSessionsViewer.js";
import { AGENT_SESSION_DELETE_ACTION_ID, AGENT_SESSION_RENAME_ACTION_ID } from "./agentSessions.js";
import { AgentSessionsFilter } from "./agentSessionsFilter.js";
function createAgentSessionArchiveButtons(configurationService) {
  const presentation = getChatSessionArchiveActionPresentation(getChatSessionArchiveActionWording(configurationService));
  return {
    archive: {
      iconClass: ThemeIcon.asClassName(presentation.archive.icon),
      tooltip: presentation.archive.title.value
    },
    unarchive: {
      iconClass: ThemeIcon.asClassName(presentation.unarchive.icon),
      tooltip: presentation.unarchive.title.value
    }
  };
}
const renameButton = {
  iconClass: ThemeIcon.asClassName(Codicon.edit),
  tooltip: localize("renameSession", "Rename")
};
const deleteButton = {
  iconClass: ThemeIcon.asClassName(Codicon.trash),
  tooltip: localize("deleteSession", "Delete")
};
function getSessionDescription(session) {
  const descriptionText = typeof session.description === "string" ? session.description : session.description ? renderAsPlaintext(session.description) : void 0;
  const timeAgo = sessionDateFromNow(session.timing.created);
  const descriptionParts = [descriptionText, session.providerLabel, timeAgo].filter((part) => !!part);
  return descriptionParts.join(" \u2022 ");
}
function getSessionButtons(session, archiveButtons) {
  const buttons = [];
  if (isLocalAgentSessionItem(session)) {
    buttons.push(renameButton);
    buttons.push(deleteButton);
  } else if (isAgentHostAgentSessionItem(session)) {
    buttons.push(renameButton);
  }
  buttons.push(session.isArchived() ? archiveButtons.unarchive : archiveButtons.archive);
  return buttons;
}
function shouldShowSessionInPicker(session, filter) {
  return !session.isArchived() && !filter.exclude(session);
}
let AgentSessionsPicker = class {
  constructor(anchor, options, agentSessionsService, quickInputService, instantiationService, commandService, configurationService) {
    this.anchor = anchor;
    this.options = options;
    this.agentSessionsService = agentSessionsService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.sorter = new AgentSessionsSorter();
  }
  async pickAgentSession() {
    const disposables = new DisposableStore();
    const picker = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    const filter = disposables.add(this.instantiationService.createInstance(AgentSessionsFilter, {}));
    picker.anchor = this.anchor;
    picker.items = this.createPickerItems(filter);
    picker.canAcceptInBackground = true;
    picker.placeholder = localize("chatAgentPickerPlaceholder", "Search agent sessions by name");
    disposables.add(picker.onDidAccept((e) => {
      const pick = picker.selectedItems[0];
      if (pick) {
        const openOptions = {
          sideBySide: e.inBackground,
          editorOptions: {
            preserveFocus: e.inBackground,
            pinned: e.inBackground
          }
        };
        if (this.options?.overrideSessionOpen) {
          this.options.overrideSessionOpen(pick.session, openOptions);
        } else {
          this.instantiationService.invokeFunction(openSession, pick.session, openOptions);
        }
      }
      if (!e.inBackground) {
        picker.hide();
      }
    }));
    disposables.add(picker.onDidTriggerItemButton(async (e) => {
      const session = e.item.session;
      let reopenResolved = false;
      if (e.button === renameButton) {
        reopenResolved = true;
        await this.commandService.executeCommand(AGENT_SESSION_RENAME_ACTION_ID, session);
      } else if (e.button === deleteButton) {
        reopenResolved = true;
        await this.commandService.executeCommand(AGENT_SESSION_DELETE_ACTION_ID, session);
      } else {
        const newArchivedState = !session.isArchived();
        session.setArchived(newArchivedState);
      }
      if (reopenResolved) {
        await this.agentSessionsService.model.resolve(session.providerType);
        this.pickAgentSession();
      } else {
        picker.items = this.createPickerItems(filter);
      }
    }));
    disposables.add(picker.onDidHide(() => disposables.dispose()));
    picker.show();
  }
  createPickerItems(filter) {
    const sessions = this.agentSessionsService.model.sessions.filter((session) => shouldShowSessionInPicker(session, filter)).sort(this.sorter.compare.bind(this.sorter));
    const items = [];
    const groupedSessions = groupAgentSessionsByDate(sessions);
    for (const group of groupedSessions.values()) {
      if (group.sessions.length > 0) {
        items.push({ type: "separator", label: group.label });
        items.push(...group.sessions.map((session) => this.toPickItem(session)));
      }
    }
    return items;
  }
  toPickItem(session) {
    const description = getSessionDescription(session);
    const buttons = getSessionButtons(session, createAgentSessionArchiveButtons(this.configurationService));
    return {
      id: session.resource.toString(),
      label: session.label,
      tooltip: session.tooltip,
      description,
      iconClass: ThemeIcon.asClassName(session.icon),
      buttons,
      session
    };
  }
};
AgentSessionsPicker = __decorateClass([
  __decorateParam(2, IAgentSessionsService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IConfigurationService)
], AgentSessionsPicker);
export {
  AgentSessionsPicker,
  createAgentSessionArchiveButtons,
  deleteButton,
  getSessionButtons,
  getSessionDescription,
  renameButton,
  shouldShowSessionInPicker
};
