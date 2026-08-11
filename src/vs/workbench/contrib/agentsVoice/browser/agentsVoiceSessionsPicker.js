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
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IAgentSessionsService } from "../../chat/browser/agentSessions/agentSessionsService.js";
import { AgentSessionsSorter, groupAgentSessionsByDate } from "../../chat/browser/agentSessions/agentSessionsViewer.js";
import { getSessionDescription, shouldShowSessionInPicker } from "../../chat/browser/agentSessions/agentSessionsPicker.js";
import { AgentSessionsFilter } from "../../chat/browser/agentSessions/agentSessionsFilter.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
const setTargetButton = {
  iconClass: ThemeIcon.asClassName(Codicon.voiceMode),
  tooltip: localize("voiceSessions.setTarget", "Set as voice target")
};
let AgentsVoiceSessionsPicker = class {
  constructor(onSelectTarget, agentSessionsService, quickInputService, instantiationService) {
    this.onSelectTarget = onSelectTarget;
    this.agentSessionsService = agentSessionsService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.sorter = new AgentSessionsSorter();
  }
  async show() {
    const disposables = new DisposableStore();
    const picker = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    const filter = disposables.add(this.instantiationService.createInstance(AgentSessionsFilter, {}));
    picker.items = this.createPickerItems(filter);
    picker.placeholder = localize("voiceSessions.placeholder", "Select a session for voice input");
    disposables.add(picker.onDidAccept(() => {
      const pick = picker.selectedItems[0];
      if (pick) {
        this.onSelectTarget(pick.session.resource);
      }
      picker.hide();
    }));
    disposables.add(picker.onDidTriggerItemButton((e) => {
      if (e.button === setTargetButton) {
        this.onSelectTarget(e.item.session.resource);
        picker.hide();
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
    return {
      id: session.resource.toString(),
      label: session.label,
      tooltip: session.tooltip,
      description,
      iconClass: ThemeIcon.asClassName(session.icon),
      buttons: [setTargetButton],
      session
    };
  }
};
AgentsVoiceSessionsPicker = __decorateClass([
  __decorateParam(1, IAgentSessionsService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IInstantiationService)
], AgentsVoiceSessionsPicker);
export {
  AgentsVoiceSessionsPicker
};
